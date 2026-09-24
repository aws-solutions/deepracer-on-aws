# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# GuardDuty Malware Protection for S3 tag polling.
GUARDDUTY_SCAN_TAG_KEY = "GuardDutyMalwareScanStatus"
GUARDDUTY_SCAN_POLL_INTERVAL_SEC = 5
GUARDDUTY_SCAN_MAX_POLLS = 12  # 12 * 5s = 60s hard limit

# Single source of truth for all known GuardDuty scan statuses.
# Value is None for clean (no error message needed), or a human-readable error message for non-clean.
GUARDDUTY_SCAN_STATUSES: dict[str, str | None] = {
    "NO_THREATS_FOUND": None,
    "THREATS_FOUND": "Malware detected in uploaded file",
    "UNSUPPORTED": "Model could not be scanned — re-upload a valid .tar.gz",
    "ACCESS_DENIED": "Scan service unavailable — check GuardDuty protection plan IAM role",
    "FAILED": "Scan service error — retry the import",
}

GUARDDUTY_CLEAN_STATUS = next(k for k, v in GUARDDUTY_SCAN_STATUSES.items() if v is None)
GUARDDUTY_NON_CLEAN_STATUSES = frozenset(k for k, v in GUARDDUTY_SCAN_STATUSES.items() if v is not None)

# Physical model archive internal structure.
PHYSICAL_MODEL_METADATA_ENTRY = "model_metadata.json"
PHYSICAL_MODEL_PB_ENTRY = "agent/model.pb"

# Optimized artifact output filenames (written under {profileId}/models/{modelId}/optimized/)
OPENVINO_MODEL_ARCHIVE = "openvino-model.tar.gz"
RPI_MODEL_ARCHIVE = "rpi-model.tar.gz"
PB_ONLY_MODEL_ARCHIVE = "pb-only-model.tar.gz"

MODEL_METADATA_FILENAME = "model_metadata.json"
MODEL_PB_FILENAME = "model.pb"
MODEL_XML_FILENAME = "model.xml"
MODEL_BIN_FILENAME = "model.bin"
MODEL_TFLITE_FILENAME = "model.tflite"

OPTIMIZATION_STATUS_IN_PROGRESS = "IN_PROGRESS"
OPTIMIZATION_STATUS_OPTIMIZED = "OPTIMIZED"
OPTIMIZATION_STATUS_FAILED = "FAILED"

MODEL_STATUS_IMPORTING = "IMPORTING"
MODEL_STATUS_READY = "READY"
MODEL_STATUS_ERROR = "ERROR"

MODEL_SOURCE_IMPORTED_PHYSICAL = "IMPORTED_PHYSICAL"

# Input tensor name format: main_level/agent/{head}/online/network_0/{segment}/{segment}
# {head}: "main" for PPO, "policy" for SAC.
TRAINING_ALGORITHM_HEAD_NAME = {
    "PPO": "main",
    "SAC": "policy",
}

# Camera/lidar sensor value -> input tensor segment string (case-sensitive).
CAMERA_SENSOR_TO_INPUT_SEGMENT = {
    "FRONT_FACING_CAMERA": "FRONT_FACING_CAMERA",
    "LEFT_CAMERA": "LEFT_CAMERA",
    "STEREO_CAMERAS": "STEREO_CAMERAS",
    "OBSERVATION_CAMERA": "observation",
}
LIDAR_SENSOR_TO_INPUT_SEGMENT = {
    "LIDAR": "LIDAR",
    "SECTOR_LIDAR": "SECTOR_LIDAR",
    "DISCRETIZED_SECTOR_LIDAR": "DISCRETIZED_SECTOR_LIDAR",
}

INPUT_HEAD_NAME_FORMAT = "main_level/agent/{head}/online/network_0/{segment}/{segment}"

# Output tensor name format differs by algorithm — not a {head} substitution
# on a shared template:
#   PPO: main_level/agent/main/online/network_1/ppo_head_0/policy
#   SAC: main_level/agent/policy/online/network_0/sac_policy_head_0/policy
OUTPUT_HEAD_NAME_FORMAT = {
    "PPO": "main_level/agent/main/online/network_1/ppo_head_0/policy",
    "SAC": "main_level/agent/policy/online/network_0/sac_policy_head_0/policy",
}
