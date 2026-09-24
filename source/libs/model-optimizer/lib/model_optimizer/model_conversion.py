# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Model conversion: OpenVINO IR v11 (Evo cars) and TFLite (RPi cars).

Both conversions are attempted independently — a failure in one does not
prevent the other, but if either fails the model is not OPTIMIZED overall.
"""

import os
import time

from aws_lambda_powertools import Logger

from .constants import (
    CAMERA_SENSOR_TO_INPUT_SEGMENT,
    INPUT_HEAD_NAME_FORMAT,
    LIDAR_SENSOR_TO_INPUT_SEGMENT,
    OUTPUT_HEAD_NAME_FORMAT,
    TRAINING_ALGORITHM_HEAD_NAME,
)

logger = Logger(service="model_optimizer")


class ConversionError(Exception):
    """Raised when a conversion step fails. Caller decides how to record the failure."""


def derive_input_tensor_names(agent_algorithm: str, sensors: dict) -> list:
    """
    Derive the frozen graph's input tensor names from ModelMetadata:
    `main_level/agent/{head}/online/network_0/{segment}/{segment}`.

    `sensors` is {"camera": CameraSensor?, "lidar": LidarSensor?}. Raises
    ValueError for an unrecognized algorithm or sensor.
    """
    head = TRAINING_ALGORITHM_HEAD_NAME.get(agent_algorithm)
    if head is None:
        raise ValueError(f"Unrecognized agentAlgorithm for tensor name derivation: {agent_algorithm}")

    segments = []

    camera_sensor = sensors.get("camera")
    if camera_sensor:
        segment = CAMERA_SENSOR_TO_INPUT_SEGMENT.get(camera_sensor)
        if segment is None:
            raise ValueError(f"Unrecognized camera sensor for tensor name derivation: {camera_sensor}")
        segments.append(segment)

    lidar_sensor = sensors.get("lidar")
    if lidar_sensor:
        segment = LIDAR_SENSOR_TO_INPUT_SEGMENT.get(lidar_sensor)
        if segment is None:
            raise ValueError(f"Unrecognized lidar sensor for tensor name derivation: {lidar_sensor}")
        segments.append(segment)

    if not segments:
        raise ValueError("ModelMetadata.sensors has neither camera nor lidar set")

    return [INPUT_HEAD_NAME_FORMAT.format(head=head, segment=segment) for segment in segments]


def derive_output_tensor_name(agent_algorithm: str) -> str:
    """
    Derive the frozen graph's output tensor name. PPO and SAC have structurally
    different output paths, not just a {head} substitution. Raises ValueError
    for an unrecognized algorithm.
    """
    output_name = OUTPUT_HEAD_NAME_FORMAT.get(agent_algorithm)
    if output_name is None:
        raise ValueError(f"Unrecognized agentAlgorithm for tensor name derivation: {agent_algorithm}")
    return output_name


def convert_to_openvino_ir(model_pb_path: str, output_dir: str, agent_algorithm: str) -> str:
    """
    Convert model.pb to OpenVINO IR v11 via ov.convert_model().

    Converts once with no constraints to detect graph outputs (names may carry a
    ":0" suffix), then matches against the expected output tensor name. Raises
    ConversionError if the expected output is not found or conversion fails.

    Returns the path to the written model.xml (model.bin is written alongside it
    by ov.save_model()). Raises ConversionError on any failure.
    """
    import openvino as ov

    os.makedirs(output_dir, exist_ok=True)
    xml_path = os.path.join(output_dir, "model.xml")

    try:
        expected_output = derive_output_tensor_name(agent_algorithm)
        start = time.monotonic()
        probe_model = ov.convert_model(model_pb_path)
        detected_outputs = [output.get_any_name() for output in probe_model.outputs]

        output_spec = next((name for name in detected_outputs if name.startswith(expected_output)), None)
        if output_spec is None:
            raise ConversionError(
                f"Expected output tensor '{expected_output}' not found in model graph. "
                f"Detected outputs: {detected_outputs}"
            )

        model = ov.convert_model(model_pb_path, output=output_spec)
        ov.save_model(model, xml_path)
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info("OpenVINO IR conversion succeeded", durationMs=duration_ms)
    except Exception as error:  # noqa: BLE001 — any conversion failure must be caught
        logger.exception("OpenVINO conversion failed", modelPbPath=model_pb_path)
        raise ConversionError(f"OpenVINO conversion failed: {error}") from error

    return xml_path


def convert_to_tflite(model_pb_path: str, output_dir: str, input_arrays: list, output_arrays: list) -> str:
    """
    Convert model.pb to TFLite via tf.compat.v1.lite.TFLiteConverter.from_frozen_graph().

    Returns the path to the written model.tflite. Raises ConversionError on any
    failure. Callers should derive input_arrays via derive_input_tensor_names()
    and output_arrays via [derive_output_tensor_name(agent_algorithm)].
    """
    import tensorflow as tf

    os.makedirs(output_dir, exist_ok=True)
    tflite_path = os.path.join(output_dir, "model.tflite")

    try:
        start = time.monotonic()
        converter = tf.compat.v1.lite.TFLiteConverter.from_frozen_graph(
            model_pb_path,
            input_arrays=input_arrays,
            output_arrays=output_arrays,
        )
        tflite_model = converter.convert()
        with open(tflite_path, "wb") as tflite_file:
            tflite_file.write(tflite_model)
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info("TFLite conversion succeeded", durationMs=duration_ms)
    except Exception as error:  # noqa: BLE001 — any conversion failure must be caught
        logger.exception("TFLite conversion failed", modelPbPath=model_pb_path)
        raise ConversionError(f"TFLite conversion failed: {error}") from error

    return tflite_path
