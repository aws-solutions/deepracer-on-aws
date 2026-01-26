// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobType } from '@deepracer-indy/database';

export const KVS_MEDIA_TYPE = 'video/h264';

export const StreamDataRetentionInHours = {
  [JobType.EVALUATION]: 1,
  [JobType.SUBMISSION]: 1,
  [JobType.TRAINING]: 168,
} as const;
