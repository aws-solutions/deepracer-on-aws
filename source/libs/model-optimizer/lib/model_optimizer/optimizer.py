# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Core Model Optimizer orchestration.

Handles both invocation modes:
  - Virtual models: async invoke from PackageModel. Failure sets
    optimizationStatus: FAILED; model `status` is never touched (stays READY).
  - Physical models: sync invoke from importModelDispatcher. The optimizer IS
    the validator — failure sets `status: ERROR` directly.
"""

import hashlib
import json
import os
import shutil
import tempfile

from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

from . import db, s3_utils
from .constants import (
    MODEL_SOURCE_IMPORTED_PHYSICAL,
    OPENVINO_MODEL_ARCHIVE,
    PB_ONLY_MODEL_ARCHIVE,
    RPI_MODEL_ARCHIVE,
)
from .model_conversion import (
    ConversionError,
    convert_to_openvino_ir,
    convert_to_tflite,
    derive_input_tensor_names,
    derive_output_tensor_name,
)
from .model_packaging import package_openvino_model, package_pb_only_model, package_rpi_model
from .s3_utils import GuardDutyScanRejectedError, InvalidArchiveStructureError

logger = Logger(service="model_optimizer")

MODEL_DATA_BUCKET_ENV = "MODEL_DATA_BUCKET_NAME"
UPLOAD_BUCKET_ENV = "UPLOAD_BUCKET_NAME"

# On-disk model_metadata.json uses different training_algorithm string values
# than the Smithy AgentAlgorithm enum.
ON_DISK_TRAINING_ALGORITHM_TO_SMITHY = {
    "clipped_ppo": "PPO",
    "sac": "SAC",
}

# On-disk `sensor` is a flat array of sensor value strings, not the Smithy
# {camera, lidar} structure. These sets classify each array entry.
CAMERA_SENSOR_VALUES = {"FRONT_FACING_CAMERA", "LEFT_CAMERA", "STEREO_CAMERAS", "OBSERVATION_CAMERA"}
LIDAR_SENSOR_VALUES = {"LIDAR", "SECTOR_LIDAR", "DISCRETIZED_SECTOR_LIDAR"}


def _md5_file(file_path: str) -> str | None:
    """Compute MD5 hex digest of a file. Returns None on failure."""
    try:
        with open(file_path, "rb") as f:
            hashing = hashlib.new("md5", usedforsecurity=False)
            for chunk in iter(lambda: f.read(65536), b""):
                hashing.update(chunk)
            return hashing.hexdigest()
    except Exception as error:
        logger.warning("Failed to compute MD5", filePath=file_path, error=str(error))
        return None


def _normalize_ddb_metadata(metadata: dict) -> tuple:
    """Normalize DDB's ModelMetadata shape into (agent_algorithm, sensors_dict)."""
    return metadata.get("agentAlgorithm"), metadata.get("sensors", {})


def _normalize_on_disk_metadata(metadata: dict) -> tuple:
    """Normalize on-disk model_metadata.json shape into (agent_algorithm, sensors_dict)."""
    training_algorithm = metadata.get("training_algorithm", "")
    agent_algorithm = ON_DISK_TRAINING_ALGORITHM_TO_SMITHY.get(training_algorithm)
    if agent_algorithm is None:
        raise ValueError(f"Unrecognized training_algorithm in model_metadata.json: {training_algorithm}")

    sensor_values = metadata.get("sensor", [])
    sensors = {}
    for sensor_value in sensor_values:
        if sensor_value in CAMERA_SENSOR_VALUES:
            sensors["camera"] = sensor_value
        elif sensor_value in LIDAR_SENSOR_VALUES:
            sensors["lidar"] = sensor_value
        else:
            raise ValueError(f"Unrecognized sensor value in model_metadata.json: {sensor_value}")

    return agent_algorithm, sensors


def run_optimization(model_id: str, profile_id: str, request_id: str, event: dict | None = None) -> dict:
    """
    Entry point invoked by lambda_function.py. `event` carries the original
    invocation payload — used for a physical import to locate the
    uploaded archive's S3 location.
    """
    event = event or {}
    work_dir = tempfile.mkdtemp(prefix=f"model_optimizer_{request_id}_")

    try:
        model_item = db.get_model_item(model_id, profile_id)
        is_physical_import = model_item.get("modelSource") == MODEL_SOURCE_IMPORTED_PHYSICAL

        if is_physical_import:
            return _run_physical_import(model_id, profile_id, event, work_dir, request_id)
        return _run_virtual_optimization(model_id, profile_id, model_item, work_dir)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _run_virtual_optimization(model_id: str, profile_id: str, model_item: dict, work_dir: str) -> dict:
    try:
        db.set_optimization_in_progress(model_id, profile_id)
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.info(
                "Model already transitioned — skipping optimization",
                modelId=model_id,
                profileId=profile_id,
            )
            return {"modelId": model_id, "profileId": profile_id, "optimizationStatus": "SKIPPED"}
        raise

    try:
        model_pb_path, model_metadata_path = _resolve_virtual_model_pb(model_item, work_dir)
        logger.debug("Virtual model files resolved", modelId=model_id, modelPbPath=model_pb_path)
        agent_algorithm, sensors = _normalize_ddb_metadata(model_item.get("metadata", {}))

        # Compute MD5 checksums
        model_md5 = _md5_file(model_pb_path)
        metadata_md5 = _md5_file(model_metadata_path)
        logger.debug("MD5 checksums computed", modelId=model_id, modelMd5=model_md5, metadataMd5=metadata_md5)

        optimized_prefix = _convert_and_upload(
            model_id,
            profile_id,
            model_pb_path,
            model_metadata_path,
            agent_algorithm,
            sensors,
            work_dir,
            bucket=os.environ[MODEL_DATA_BUCKET_ENV],
        )
    except Exception as exc:  # noqa: BLE001 — every failure must set FAILED
        logger.exception(
            "Virtual model optimization failed",
            modelId=model_id,
            profileId=profile_id,
        )
        db.set_optimization_failed(model_id, profile_id, error_message=str(exc))
        return {"modelId": model_id, "profileId": profile_id, "optimizationStatus": "FAILED"}

    db.set_optimization_optimized(
        model_id,
        profile_id,
        optimized_prefix,
        model_md5=model_md5,
        metadata_md5=metadata_md5,
        has_metadata=bool(model_item.get("metadata")),
    )
    logger.info("Virtual model optimization completed", modelId=model_id, profileId=profile_id)
    return {"modelId": model_id, "profileId": profile_id, "optimizationStatus": "OPTIMIZED"}


def _run_physical_import(model_id: str, profile_id: str, event: dict, work_dir: str, request_id: str) -> dict:
    try:
        upload_bucket = os.environ[UPLOAD_BUCKET_ENV]
        upload_key = _physical_upload_key(event)

        if os.environ.get("ENABLE_GUARDDUTY_MALWARE_SCAN", "true").lower() != "false":
            s3_utils.poll_guardduty_scan_status(upload_bucket, upload_key)
        else:
            logger.info("GuardDuty malware scan disabled, skipping tag poll")

        archive_path = os.path.join(work_dir, "upload.tar.gz")
        s3_utils.download_file(upload_bucket, upload_key, archive_path)
        logger.debug("Archive downloaded", modelId=model_id, uploadKey=upload_key)

        extracted_dir = os.path.join(work_dir, "extracted")
        s3_utils.extract_tar_gz(archive_path, extracted_dir)
        model_pb_path, model_metadata_path = s3_utils.resolve_physical_model_pb(extracted_dir)
        logger.debug("Archive extracted", modelId=model_id, modelPbPath=model_pb_path)

        # Compute MD5 checksums
        model_md5 = _md5_file(model_pb_path)
        metadata_md5 = _md5_file(model_metadata_path)
        logger.debug("MD5 checksums computed", modelId=model_id, modelMd5=model_md5, metadataMd5=metadata_md5)

        with open(model_metadata_path) as metadata_file:
            physical_metadata = json.load(metadata_file)
        agent_algorithm, sensors = _normalize_on_disk_metadata(physical_metadata)
        logger.debug("Physical metadata parsed", modelId=model_id, agentAlgorithm=agent_algorithm, sensors=sensors)

        optimized_prefix = _convert_and_upload(
            model_id,
            profile_id,
            model_pb_path,
            model_metadata_path,
            agent_algorithm,
            sensors,
            work_dir,
            bucket=os.environ[MODEL_DATA_BUCKET_ENV],
        )

        # Preserve the original archive in the model storage bucket AFTER successful
        # conversion. The upload bucket has a 24hr lifecycle; copying here ensures the
        # operator's original tar.gz is available for download indefinitely.
        model_data_bucket = os.environ[MODEL_DATA_BUCKET_ENV]
        original_archive_key = f"{optimized_prefix}original-model.tar.gz"
        s3_utils.copy_object(upload_bucket, upload_key, model_data_bucket, original_archive_key)
        logger.info("Original archive copied to model storage", modelId=model_id, destKey=original_archive_key)

        # Write terminal READY state — inside try so any failure (malformed action_space,
        # DDB error, etc.) falls into the catch-all and reaches ERROR, never stuck IMPORTING.
        db.set_physical_import_ready(
            model_id,
            profile_id,
            optimized_prefix,
            agent_algorithm,
            sensors,
            physical_metadata.get("action_space", []),
            model_md5=model_md5,
            metadata_md5=metadata_md5,
        )
        logger.info("Physical model import completed", modelId=model_id, profileId=profile_id)
    except (GuardDutyScanRejectedError, InvalidArchiveStructureError) as error:
        logger.warning(
            "Physical model import rejected",
            modelId=model_id,
            profileId=profile_id,
            error=str(error),
        )
        db.set_physical_import_error(model_id, profile_id, str(error))
        return {"modelId": model_id, "profileId": profile_id, "status": "ERROR"}
    except (ConversionError, ValueError) as error:
        logger.warning(
            "Physical model import failed — conversion or validation error",
            modelId=model_id,
            profileId=profile_id,
            error=str(error),
        )
        generic_message = (
            f"Model conversion failed — the uploaded model format may be incompatible. Request ID: {request_id}"
        )
        db.set_physical_import_error(model_id, profile_id, generic_message)
        return {"modelId": model_id, "profileId": profile_id, "status": "ERROR"}
    except Exception:  # noqa: BLE001 — every failure must reach a terminal state
        logger.exception(
            "Physical model import failed unexpectedly",
            modelId=model_id,
            profileId=profile_id,
        )
        generic_message = (
            f"Unexpected error occurred while processing the import. "
            f"Please try again in few minutes or contact support if issue persists with Request ID: {request_id}"
        )
        db.set_physical_import_error(model_id, profile_id, generic_message)
        return {"modelId": model_id, "profileId": profile_id, "status": "ERROR"}

    return {"modelId": model_id, "profileId": profile_id, "status": "READY", "optimizationStatus": "OPTIMIZED"}


def _physical_upload_key(event: dict) -> str:
    s3_location = event.get("s3Location")
    if not s3_location:
        raise RuntimeError("Physical import event is missing required s3Location field")
    _, key = s3_utils.parse_s3_uri(s3_location)
    return key


def _resolve_virtual_model_pb(model_item: dict, work_dir: str) -> tuple:
    """
    Locates model.pb for a virtual model — either from SageMaker training
    artifacts (modelArtifactS3Location set) or from an imported model's
    deepracer_checkpoints.json (not set).
    """
    asset_locations = model_item.get("assetS3Locations", {})
    model_artifact_s3_location = asset_locations.get("modelArtifactS3Location")
    model_metadata_s3_location = asset_locations.get("modelMetadataS3Location")

    if not model_metadata_s3_location:
        raise ValueError("Model is missing assetS3Locations.modelMetadataS3Location")

    metadata_bucket, metadata_key = s3_utils.parse_s3_uri(model_metadata_s3_location)
    model_metadata_path = os.path.join(work_dir, "model_metadata.json")
    s3_utils.download_file(metadata_bucket, metadata_key, model_metadata_path)

    if model_artifact_s3_location:
        # Trained in-platform model: SageMaker tar.gz containing agent/model.pb
        artifact_bucket, artifact_key = s3_utils.parse_s3_uri(model_artifact_s3_location)
        archive_path = os.path.join(work_dir, "model-artifacts.tar.gz")
        s3_utils.download_file(artifact_bucket, artifact_key, archive_path)

        extracted_dir = os.path.join(work_dir, "extracted")
        s3_utils.extract_tar_gz(archive_path, extracted_dir)
        model_pb_path = os.path.join(extracted_dir, "agent", "model.pb")
        if not os.path.isfile(model_pb_path):
            raise ValueError("agent/model.pb not found in SageMaker model artifacts")
        return model_pb_path, model_metadata_path

    # Imported virtual model: resolve via deepracer_checkpoints.json
    sagemaker_artifacts_s3_location = asset_locations.get("sageMakerArtifactsS3Location")
    if not sagemaker_artifacts_s3_location:
        raise ValueError("Model is missing assetS3Locations.sageMakerArtifactsS3Location")

    artifacts_bucket, artifacts_prefix = s3_utils.parse_s3_uri(sagemaker_artifacts_s3_location)
    checkpoints_key = f"{artifacts_prefix}model/deepracer_checkpoints.json"
    checkpoints_json = s3_utils.read_json_object(artifacts_bucket, checkpoints_key)
    checkpoint_number = s3_utils.parse_best_checkpoint_number(checkpoints_json)

    model_pb_key = f"{artifacts_prefix}model/model_{checkpoint_number}.pb"
    model_pb_path = os.path.join(work_dir, "model.pb")
    s3_utils.download_file(artifacts_bucket, model_pb_key, model_pb_path)

    return model_pb_path, model_metadata_path


def _convert_and_upload(
    model_id: str,
    profile_id: str,
    model_pb_path: str,
    model_metadata_path: str,
    agent_algorithm: str,
    sensors: dict,
    work_dir: str,
    bucket: str,
) -> str:
    """
    Runs both conversions independently, packages all three archives
    (openvino/rpi/pb-only), and uploads them to the optimized/ S3 prefix. Raises
    ConversionError if either conversion fails — pb-only is still produced even
    if IR/TFLite conversion fails, since it requires no conversion step itself.
    """
    optimized_prefix = f"{profile_id}/models/{model_id}/optimized/"
    output_dir = os.path.join(work_dir, "output")
    logger.debug("Starting conversions", modelId=model_id, outputDir=output_dir, optimizedPrefix=optimized_prefix)

    # pb-only archive never fails independently — it is a straight repackage.
    pb_only_path = os.path.join(output_dir, PB_ONLY_MODEL_ARCHIVE)
    package_pb_only_model(pb_only_path, model_metadata_path, model_pb_path)
    s3_utils.upload_file(pb_only_path, bucket, f"{optimized_prefix}{PB_ONLY_MODEL_ARCHIVE}")
    logger.info("pb-only archive uploaded", modelId=model_id)

    conversion_errors = []

    try:
        xml_path = convert_to_openvino_ir(model_pb_path, output_dir, agent_algorithm)
        bin_path = xml_path.replace(".xml", ".bin")
        openvino_path = os.path.join(output_dir, OPENVINO_MODEL_ARCHIVE)
        package_openvino_model(openvino_path, model_metadata_path, model_pb_path, xml_path, bin_path)
        s3_utils.upload_file(openvino_path, bucket, f"{optimized_prefix}{OPENVINO_MODEL_ARCHIVE}")
    except ConversionError as error:
        conversion_errors.append(str(error))
        logger.warning("OpenVINO conversion failed", modelId=model_id, error=str(error))

    try:
        input_arrays = derive_input_tensor_names(agent_algorithm, sensors)
        output_arrays = [derive_output_tensor_name(agent_algorithm)]
        tflite_path = convert_to_tflite(model_pb_path, output_dir, input_arrays, output_arrays)
        rpi_path = os.path.join(output_dir, RPI_MODEL_ARCHIVE)
        package_rpi_model(rpi_path, model_metadata_path, model_pb_path, tflite_path)
        s3_utils.upload_file(rpi_path, bucket, f"{optimized_prefix}{RPI_MODEL_ARCHIVE}")
    except (ConversionError, ValueError) as error:
        conversion_errors.append(str(error))
        logger.warning("TFLite conversion failed", modelId=model_id, error=str(error))

    if conversion_errors:
        raise ConversionError("; ".join(conversion_errors))

    return optimized_prefix
