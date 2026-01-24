// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_PROFILE_ID_1 } from '@deepracer-indy/database';
import { EvaluationMetric, EpisodeStatus } from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';

export const TEST_OPERATION_CONTEXT: HandlerContext = {
  profileId: TEST_PROFILE_ID_1,
  operationName: 'operation',
};

export const MOCK_EVALUATION_METRICS: EvaluationMetric[] = [
  {
    completionPercentage: 55,
    crashCount: 0,
    elapsedTimeInMilliseconds: 5400,
    episodeStatus: EpisodeStatus.OFF_TRACK,
    offTrackCount: 5,
    resetCount: 5,
    trial: 1,
  },
  {
    completionPercentage: 85,
    crashCount: 0,
    elapsedTimeInMilliseconds: 8400,
    episodeStatus: EpisodeStatus.OFF_TRACK,
    offTrackCount: 7,
    resetCount: 7,
    trial: 2,
  },
];
