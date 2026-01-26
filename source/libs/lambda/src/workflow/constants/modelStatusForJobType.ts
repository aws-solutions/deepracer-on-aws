// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobType } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';

export const ModelStatusForJobType = {
  [JobType.EVALUATION]: ModelStatus.EVALUATING,
  [JobType.SUBMISSION]: ModelStatus.SUBMITTING,
  [JobType.TRAINING]: ModelStatus.TRAINING,
} as const;
