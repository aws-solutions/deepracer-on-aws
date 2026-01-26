// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrainingInstanceType } from '@aws-sdk/client-sagemaker';

type TrainingInstanceWithNoQuotaCode = 'ml.p2.16xlarge' | 'ml.p2.8xlarge' | 'ml.p2.xlarge' | 'ml.t3.medium';

export interface DeepRacerIndySageMakerConfig {
  instanceCount: number;
  instanceType: Exclude<TrainingInstanceType, TrainingInstanceWithNoQuotaCode>;
  instanceVolumeSizeInGB: number;
}
