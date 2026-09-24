# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
S3 access, GuardDuty scan tag polling, and three-path model.pb resolution for the
Model Optimizer Lambda.
"""

from __future__ import annotations

import json
import os
import re
import tarfile
import time
from typing import TYPE_CHECKING

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

from .constants import (
    GUARDDUTY_CLEAN_STATUS,
    GUARDDUTY_NON_CLEAN_STATUSES,
    GUARDDUTY_SCAN_MAX_POLLS,
    GUARDDUTY_SCAN_POLL_INTERVAL_SEC,
    GUARDDUTY_SCAN_STATUSES,
    GUARDDUTY_SCAN_TAG_KEY,
    PHYSICAL_MODEL_METADATA_ENTRY,
    PHYSICAL_MODEL_PB_ENTRY,
)

logger = Logger(service="model_optimizer")

_s3_client = None

GUARDDUTY_TIMEOUT_MESSAGE = "Malware scan timed out — retry the import"


class GuardDutyScanRejectedError(Exception):
    """Raised when a GuardDuty scan tag is non-clean or times out."""


class InvalidArchiveStructureError(Exception):
    """Raised when an extracted archive is missing required entries."""


def _client() -> S3Client:
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3")
    return _s3_client


def parse_s3_uri(s3_uri: str) -> tuple:
    """Parse `s3://bucket/key` into (bucket, key)."""
    match = re.match(r"^s3://([^/]+)/(.+)$", s3_uri)
    if not match:
        raise ValueError(f"Invalid S3 URI: {s3_uri}")
    return match.group(1), match.group(2)


def poll_guardduty_scan_status(bucket: str, key: str) -> None:
    """
    Poll s3:GetObjectTagging for GuardDutyMalwareScanStatus with 5s backoff, max 12
    polls (60s hard limit).

    Raises GuardDutyScanRejectedError if the scan result is non-clean or the tag
    never appears within the timeout. Returns normally only when the tag is
    NO_THREATS_FOUND.
    """
    for attempt in range(GUARDDUTY_SCAN_MAX_POLLS):
        try:
            response = _client().get_object_tagging(Bucket=bucket, Key=key)
        except ClientError as error:
            logger.exception("Failed to poll GuardDuty scan tag", bucket=bucket, key=key)
            raise GuardDutyScanRejectedError(GUARDDUTY_SCAN_STATUSES["FAILED"]) from error

        tags = {tag["Key"]: tag["Value"] for tag in response.get("TagSet", [])}
        scan_status = tags.get(GUARDDUTY_SCAN_TAG_KEY)

        if scan_status is None:
            # Tag absent — scan still in progress. Wait and poll again.
            if attempt < GUARDDUTY_SCAN_MAX_POLLS - 1:
                time.sleep(GUARDDUTY_SCAN_POLL_INTERVAL_SEC)
            continue

        if scan_status == GUARDDUTY_CLEAN_STATUS:
            logger.info("GuardDuty scan clean", bucket=bucket, key=key, attempt=attempt)
            return

        if scan_status in GUARDDUTY_NON_CLEAN_STATUSES:
            logger.warning("GuardDuty scan rejected", bucket=bucket, key=key, status=scan_status)
            raise GuardDutyScanRejectedError(GUARDDUTY_SCAN_STATUSES[scan_status])

        # Unknown status — fail immediately rather than silently polling until timeout
        logger.warning("Unknown GuardDuty scan status", bucket=bucket, key=key, status=scan_status)
        raise GuardDutyScanRejectedError(f"Unrecognized scan status: {scan_status}")

    logger.warning("GuardDuty scan timed out after max polls", bucket=bucket, key=key)
    raise GuardDutyScanRejectedError(GUARDDUTY_TIMEOUT_MESSAGE)


def download_file(bucket: str, key: str, local_path: str) -> None:
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    _client().download_file(bucket, key, local_path)
    file_size = os.path.getsize(local_path)
    logger.debug("File downloaded from S3", bucket=bucket, key=key, fileSizeBytes=file_size)


def copy_object(source_bucket: str, source_key: str, dest_bucket: str, dest_key: str) -> None:
    """Copy an S3 object between buckets (or within the same bucket)."""
    _client().copy_object(
        CopySource={"Bucket": source_bucket, "Key": source_key},
        Bucket=dest_bucket,
        Key=dest_key,
        TaggingDirective="REPLACE",
    )


def upload_file(local_path: str, bucket: str, key: str) -> None:
    _client().upload_file(local_path, bucket, key)


def read_json_object(bucket: str, key: str) -> dict:
    response = _client().get_object(Bucket=bucket, Key=key)
    return json.loads(response["Body"].read())


def extract_tar_gz(archive_path: str, dest_dir: str) -> None:
    """
    Extract a tar.gz archive, rejecting members with path traversal or any
    member type other than regular file/directory before extraction.
    """
    os.makedirs(dest_dir, exist_ok=True)
    real_dest_dir = os.path.realpath(dest_dir)

    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive.getmembers():
            member_path = os.path.realpath(os.path.join(dest_dir, member.name))
            if not member_path.startswith(real_dest_dir + os.sep) and member_path != real_dest_dir:
                raise InvalidArchiveStructureError(f"Path traversal detected in archive member: {member.name}")
            if not (member.isfile() or member.isdir()):
                raise InvalidArchiveStructureError(f"Unsupported archive member type for: {member.name}")

        # NOSONAR — member paths validated before extraction; filter="data" as additional defense-in-depth
        archive.extractall(dest_dir, filter="data")
        logger.debug("Archive extracted", destDir=dest_dir, memberCount=len(archive.getmembers()))


def resolve_physical_model_pb(extracted_dir: str) -> tuple:
    """
    Validate and locate model.pb + model_metadata.json for an extracted physical
    model archive. Supports two layouts:
      - agent/model.pb + model_metadata.json (standard DeepRacer export)
      - model.pb + model_metadata.json at root (some older/third-party exports)

    Returns (model_pb_path, model_metadata_path). Raises InvalidArchiveStructureError
    if either required entry is missing from both locations.
    """
    # Derive filenames from constants to avoid drift
    model_pb_filename = os.path.basename(PHYSICAL_MODEL_PB_ENTRY)  # "model.pb"
    agent_subdir = os.path.dirname(PHYSICAL_MODEL_PB_ENTRY)  # "agent"

    # Try agent/ subdirectory first (standard layout)
    agent_pb = os.path.join(extracted_dir, PHYSICAL_MODEL_PB_ENTRY)
    # Fallback: root level
    root_pb = os.path.join(extracted_dir, model_pb_filename)
    model_pb_path = agent_pb if os.path.isfile(agent_pb) else root_pb if os.path.isfile(root_pb) else None

    # model_metadata.json: check root first (both layouts put it at root), then agent/
    root_metadata = os.path.join(extracted_dir, PHYSICAL_MODEL_METADATA_ENTRY)
    agent_metadata = os.path.join(extracted_dir, agent_subdir, PHYSICAL_MODEL_METADATA_ENTRY)
    model_metadata_path = (
        root_metadata if os.path.isfile(root_metadata) else agent_metadata if os.path.isfile(agent_metadata) else None
    )

    missing = []
    if not model_pb_path:
        missing.append(f"{model_pb_filename} (checked {PHYSICAL_MODEL_PB_ENTRY} and {model_pb_filename})")
    if not model_metadata_path:
        missing.append(f"{PHYSICAL_MODEL_METADATA_ENTRY} (checked root and {agent_subdir}/)")
    if missing:
        raise InvalidArchiveStructureError(
            f"Invalid physical model archive — missing required entries: {', '.join(missing)}"
        )

    return model_pb_path, model_metadata_path


def parse_best_checkpoint_number(checkpoints_json: dict) -> int:
    """
    Extract the checkpoint number from deepracer_checkpoints.json's
    best_checkpoint.name (e.g. "4_Step-1752.ckpt" -> 4).
    """
    best_checkpoint_name = checkpoints_json.get("best_checkpoint", {}).get("name")
    if not best_checkpoint_name:
        raise ValueError("deepracer_checkpoints.json is missing best_checkpoint.name")

    match = re.match(r"^(\d+)_", best_checkpoint_name)
    if not match:
        raise ValueError(f"Could not parse checkpoint number from best_checkpoint.name: {best_checkpoint_name}")

    return int(match.group(1))
