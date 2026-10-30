# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os

from botocore.config import Config


def get_custom_user_agent() -> str:
    return os.environ.get("CUSTOM_USER_AGENT", "AwsSolution/SO0310/v0.0.0")


def get_boto_config() -> Config:
    return Config(user_agent_extra=get_custom_user_agent())
