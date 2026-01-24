// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { sageMakerDefaults } from '#defaults/sageMakerDefaults.js';
import type { DeepRacerIndySageMakerConfig } from '#types/sageMakerConfig.js';

export const deepRacerIndySageMakerConfig: DeepRacerIndySageMakerConfig = {
  instanceCount: sageMakerDefaults.instanceCount,
  instanceType: sageMakerDefaults.instanceType,
  instanceVolumeSizeInGB: sageMakerDefaults.instanceVolumeSizeInGB,
};
