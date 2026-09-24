# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
DynamoDB access for the Model Optimizer Lambda.

Talks directly to the shared single-table via boto3 (no ElectroDB — that's
TypeScript-only). Keys mirror ModelsEntity's byProfileId index:
pk=profile_{profileId}, sk=model_{modelId}.
"""

from __future__ import annotations

import os
from decimal import Decimal
from typing import TYPE_CHECKING

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.service_resource import Table
    from mypy_boto3_dynamodb.type_defs import UpdateItemInputTableUpdateItemTypeDef

from .constants import (
    MODEL_STATUS_ERROR,
    MODEL_STATUS_IMPORTING,
    MODEL_STATUS_READY,
    OPTIMIZATION_STATUS_FAILED,
    OPTIMIZATION_STATUS_IN_PROGRESS,
    OPTIMIZATION_STATUS_OPTIMIZED,
)

logger = Logger(service="model_optimizer")

_dynamodb_resource = None


def _table() -> Table:
    global _dynamodb_resource
    if _dynamodb_resource is None:
        _dynamodb_resource = boto3.resource("dynamodb")
    table_name = os.environ.get("DATABASE_NAME")
    if not table_name:
        raise RuntimeError("DATABASE_NAME environment variable is not defined")
    return _dynamodb_resource.Table(table_name)


def _model_key(model_id: str, profile_id: str) -> dict:
    return {"pk": f"profile_{profile_id}", "sk": f"model_{model_id}"}


def get_model_item(model_id: str, profile_id: str) -> dict:
    """Fetch a model item. Raises if the item does not exist."""
    response = _table().get_item(Key=_model_key(model_id, profile_id))
    item = response.get("Item")
    if item is None:
        logger.warning("Model not found", modelId=model_id, profileId=profile_id)
        raise ValueError("Model not found")
    return item


def set_optimization_in_progress(model_id: str, profile_id: str) -> None:
    """
    Set optimizationStatus: IN_PROGRESS. Allows re-trigger from null, IN_PROGRESS,
    or FAILED. Raises on a condition failure — an invalid state for the request.
    """
    _update_optimization_status(
        model_id,
        profile_id,
        new_status=OPTIMIZATION_STATUS_IN_PROGRESS,
        allowed_current_statuses=[None, OPTIMIZATION_STATUS_IN_PROGRESS, OPTIMIZATION_STATUS_FAILED],
    )


def set_optimization_optimized(
    model_id: str,
    profile_id: str,
    optimized_artifacts_s3_prefix: str,
    model_md5: str | None = None,
    metadata_md5: str | None = None,
    has_metadata: bool = True,
) -> None:
    """
    Set optimizationStatus: OPTIMIZED. Does not touch model `status`. Guarded on
    optimizationStatus = IN_PROGRESS; a condition failure means a newer
    invocation already completed, so it's logged and skipped rather than raised.
    """
    update_expr = "SET optimizationStatus = :optimized, optimizedArtifactsS3Prefix = :prefix"
    expr_values = {
        ":optimized": OPTIMIZATION_STATUS_OPTIMIZED,
        ":prefix": optimized_artifacts_s3_prefix,
        ":in_progress": OPTIMIZATION_STATUS_IN_PROGRESS,
    }
    # Only write MD5 to the nested metadata map if the model has metadata (virtual models
    # from training always do, but guard against edge cases where it's absent — DDB rejects
    # SET on a nested path when the parent map doesn't exist).
    if model_md5 and has_metadata:
        update_expr += ", metadata.modelMD5 = :modelMd5"
        expr_values[":modelMd5"] = model_md5
    if metadata_md5 and has_metadata:
        update_expr += ", metadata.metadataMD5 = :metadataMd5"
        expr_values[":metadataMd5"] = metadata_md5

    _conditional_update_or_skip(
        model_id,
        profile_id,
        update_expression=update_expr,
        condition_expression="optimizationStatus = :in_progress",
        expression_attribute_values=expr_values,
        skip_log_message=(
            f"Skipped setting optimizationStatus: {OPTIMIZATION_STATUS_OPTIMIZED}"
            f" — model was no longer {OPTIMIZATION_STATUS_IN_PROGRESS}"
        ),
    )


def set_optimization_failed(model_id: str, profile_id: str, error_message: str = "") -> None:
    """
    Set optimizationStatus: FAILED. Does not touch model `status` — a failed
    optimization must not affect virtual race eligibility. Guarded on
    optimizationStatus = IN_PROGRESS, same reasoning as set_optimization_optimized.
    Stores the error message for surfacing in the UI.
    """
    _conditional_update_or_skip(
        model_id,
        profile_id,
        update_expression="SET optimizationStatus = :failed, optimizationErrorMessage = :errMsg",
        condition_expression="optimizationStatus = :in_progress",
        expression_attribute_values={
            ":failed": OPTIMIZATION_STATUS_FAILED,
            ":in_progress": OPTIMIZATION_STATUS_IN_PROGRESS,
            ":errMsg": error_message,
        },
        skip_log_message=(
            f"Skipped setting optimizationStatus: {OPTIMIZATION_STATUS_FAILED}"
            f" — model was no longer {OPTIMIZATION_STATUS_IN_PROGRESS}"
        ),
    )


def set_physical_import_ready(
    model_id: str,
    profile_id: str,
    optimized_artifacts_s3_prefix: str,
    agent_algorithm: str,
    sensors: dict,
    action_space,
    model_md5: str | None = None,
    metadata_md5: str | None = None,
) -> None:
    """
    Physical import success: status -> READY, optimizationStatus -> OPTIMIZED,
    metadata populated from the archive's model_metadata.json.
    Guarded on status = IMPORTING; a condition failure means a newer invocation
    already completed, so it's logged and skipped rather than raised.
    """
    # Convert on-disk action_space to DDB's ActionSpace union shape.
    # Discrete: list of dicts with speed/steering_angle keys.
    # Continuous: dict with speed/steering_angle range keys.
    if isinstance(action_space, list):
        discrete_actions = []
        for a in action_space:
            if "speed" not in a or "steering_angle" not in a:
                logger.warning(
                    "Discrete action entry missing speed or steering_angle — using fallback 0",
                    modelId=model_id,
                    entry=a,
                )
            discrete_actions.append(
                {
                    "speed": Decimal(str(a.get("speed", 0))),
                    "steeringAngle": Decimal(str(a.get("steering_angle", 0))),
                }
            )
        action_space_ddb: dict = {"discrete": discrete_actions}
    elif isinstance(action_space, dict):
        speed = action_space.get("speed", {})
        steering = action_space.get("steering_angle", {})
        if not speed or not steering:
            logger.warning(
                "Continuous action_space missing speed or steering_angle keys — using DeepRacer defaults",
                modelId=model_id,
                actionSpaceKeys=list(action_space.keys()),
            )
        action_space_ddb = {
            "continous": {
                "lowSpeed": Decimal(str(speed.get("low", 0.5))),
                "highSpeed": Decimal(str(speed.get("high", 4.0))),
                "lowSteeringAngle": Decimal(str(steering.get("low", -30.0))),
                "highSteeringAngle": Decimal(str(steering.get("high", 30.0))),
            }
        }
    else:
        # Fallback: unknown format, store as discrete empty
        action_space_ddb = {"discrete": []}

    metadata = {
        "agentAlgorithm": agent_algorithm,
        "sensors": sensors,
        "actionSpace": action_space_ddb,
    }
    if model_md5:
        metadata["modelMD5"] = model_md5
    if metadata_md5:
        metadata["metadataMD5"] = metadata_md5

    _conditional_update_or_skip(
        model_id,
        profile_id,
        update_expression=(
            "SET #status = :ready, optimizationStatus = :optimized, "
            "optimizedArtifactsS3Prefix = :prefix, metadata = :metadata"
        ),
        condition_expression="#status = :importing",
        expression_attribute_names={"#status": "status"},
        expression_attribute_values={
            ":ready": MODEL_STATUS_READY,
            ":optimized": OPTIMIZATION_STATUS_OPTIMIZED,
            ":prefix": optimized_artifacts_s3_prefix,
            ":importing": MODEL_STATUS_IMPORTING,
            ":metadata": metadata,
        },
        skip_log_message=f"Skipped setting status: {MODEL_STATUS_READY} — model was no longer {MODEL_STATUS_IMPORTING}",
    )


def set_physical_import_error(model_id: str, profile_id: str, error_message: str) -> None:
    """
    Physical import failure: status -> ERROR. Guarded on status = IMPORTING,
    same reasoning as set_physical_import_ready.
    """
    _conditional_update_or_skip(
        model_id,
        profile_id,
        update_expression="SET #status = :error, importErrorMessage = :message",
        condition_expression="#status = :importing",
        expression_attribute_names={"#status": "status"},
        expression_attribute_values={
            ":error": MODEL_STATUS_ERROR,
            ":message": error_message,
            ":importing": MODEL_STATUS_IMPORTING,
        },
        skip_log_message=f"Skipped setting status: {MODEL_STATUS_ERROR} — model was no longer {MODEL_STATUS_IMPORTING}",
    )


def _conditional_update_or_skip(
    model_id: str,
    profile_id: str,
    *,
    update_expression: str,
    condition_expression: str,
    expression_attribute_values: dict,
    skip_log_message: str,
    expression_attribute_names: dict | None = None,
) -> None:
    """
    Perform a conditional DDB update. If the condition fails
    (ConditionalCheckFailedException), log a warning and return without raising —
    this indicates a stale/duplicate invocation, not a caller error.
    Non-conditional DDB errors are re-raised.
    """
    table = _table()
    kwargs: UpdateItemInputTableUpdateItemTypeDef = {
        "Key": _model_key(model_id, profile_id),
        "UpdateExpression": update_expression,
        "ConditionExpression": condition_expression,
        "ExpressionAttributeValues": expression_attribute_values,
    }
    if expression_attribute_names:
        kwargs["ExpressionAttributeNames"] = expression_attribute_names

    try:
        table.update_item(**kwargs)
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.warning(skip_log_message, modelId=model_id, profileId=profile_id)
            return
        raise


def _update_optimization_status(
    model_id: str,
    profile_id: str,
    new_status: str,
    allowed_current_statuses: list,
) -> None:
    if not allowed_current_statuses:
        raise ValueError("allowed_current_statuses must not be empty")

    table = _table()
    non_null_statuses = [status for status in allowed_current_statuses if status is not None]
    allows_absent = None in allowed_current_statuses

    condition_parts = []
    expression_values = {":new_status": new_status}

    if non_null_statuses:
        placeholders = []
        for index, status in enumerate(non_null_statuses):
            placeholder = f":current_{index}"
            expression_values[placeholder] = status
            placeholders.append(placeholder)
        condition_parts.append(f"optimizationStatus IN ({', '.join(placeholders)})")

    if allows_absent:
        condition_parts.append("attribute_not_exists(optimizationStatus)")

    status_condition = " OR ".join(condition_parts)
    condition_expression = f"attribute_exists(pk) AND ({status_condition})"

    try:
        table.update_item(
            Key=_model_key(model_id, profile_id),
            UpdateExpression="SET optimizationStatus = :new_status",
            ConditionExpression=condition_expression,
            ExpressionAttributeValues=expression_values,
        )
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.warning(
                "Optimization status transition rejected — condition not met",
                modelId=model_id,
                profileId=profile_id,
                newStatus=new_status,
            )
            # Re-raise intentionally: unlike the terminal-write helpers (which swallow
            # condition failures as benign races), a failure HERE means the model is in a state
            # that doesn't allow optimization (e.g. already OPTIMIZED) — a genuine client error
            # that the caller (PackageModel handler) should surface as 400.
            raise
        raise
