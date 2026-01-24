// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepRacerIndySageMakerConfig } from '#types/sageMakerConfig.js';

export const sageMakerDefaults: DeepRacerIndySageMakerConfig = {
  instanceCount: 1,
  instanceType: 'ml.c5.4xlarge',
  instanceVolumeSizeInGB: 100,
};
