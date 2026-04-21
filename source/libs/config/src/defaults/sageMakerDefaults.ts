// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepRacerIndySageMakerConfig } from '#types/sageMakerConfig.js';

export const sageMakerDefaults: DeepRacerIndySageMakerConfig = {
  instanceCount: 1,
  // @ts-expect-error ml.c7i.4xlarge is a valid SageMaker instance type but not yet in the installed @aws-sdk/client-sagemaker@3.654.0 type definitions.
  instanceType: 'ml.c7i.4xlarge',
  instanceVolumeSizeInGB: 100,
};
