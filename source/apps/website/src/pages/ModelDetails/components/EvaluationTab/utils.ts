// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EvaluationMetric } from '@deepracer-indy/typescript-client';

import { millisToMinutesAndSeconds } from '../../../../utils/dateTimeUtils.js';

export const getBestLapTime = (metrics: EvaluationMetric[]) => {
  const bestLapTime = metrics.reduce((acc, current) => {
    if (current.completionPercentage === 100 && (!acc || current.elapsedTimeInMilliseconds < acc)) {
      return current.elapsedTimeInMilliseconds;
    }
    return acc;
  }, 0);

  return millisToMinutesAndSeconds(bestLapTime);
};
