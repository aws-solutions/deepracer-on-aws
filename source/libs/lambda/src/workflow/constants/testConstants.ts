// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_EVALUATION_ITEM } from '@deepracer-indy/database';

import type { EvaluationMetricsFile } from '../types/evaluationMetricsFile.js';

export const TEST_EVALUATION_METRICS_FILE: EvaluationMetricsFile = {
  metrics: [
    {
      completion_percentage: TEST_EVALUATION_ITEM.metrics[0].completionPercentage,
      metric_time: 41113,
      start_time: 4431,
      elapsed_time_in_milliseconds: TEST_EVALUATION_ITEM.metrics[0].elapsedTimeInMilliseconds,
      episode_status: TEST_EVALUATION_ITEM.metrics[0].episodeStatus,
      crash_count: TEST_EVALUATION_ITEM.metrics[0].crashCount,
      immobilized_count: 0,
      off_track_count: TEST_EVALUATION_ITEM.metrics[0].offTrackCount,
      reversed_count: 0,
      reset_count: TEST_EVALUATION_ITEM.metrics[0].resetCount,
      trial: TEST_EVALUATION_ITEM.metrics[0].trial,
    },
    {
      completion_percentage: TEST_EVALUATION_ITEM.metrics[1].completionPercentage,
      metric_time: 82248,
      start_time: 41517,
      elapsed_time_in_milliseconds: TEST_EVALUATION_ITEM.metrics[1].elapsedTimeInMilliseconds,
      episode_status: TEST_EVALUATION_ITEM.metrics[1].episodeStatus,
      crash_count: TEST_EVALUATION_ITEM.metrics[1].crashCount,
      immobilized_count: 0,
      off_track_count: TEST_EVALUATION_ITEM.metrics[1].offTrackCount,
      reversed_count: 0,
      reset_count: TEST_EVALUATION_ITEM.metrics[1].resetCount,
      trial: TEST_EVALUATION_ITEM.metrics[1].trial,
    },
    {
      completion_percentage: TEST_EVALUATION_ITEM.metrics[2].completionPercentage,
      metric_time: 125649,
      start_time: 82790,
      elapsed_time_in_milliseconds: TEST_EVALUATION_ITEM.metrics[2].elapsedTimeInMilliseconds,
      episode_status: TEST_EVALUATION_ITEM.metrics[2].episodeStatus,
      crash_count: TEST_EVALUATION_ITEM.metrics[2].crashCount,
      immobilized_count: 0,
      off_track_count: TEST_EVALUATION_ITEM.metrics[2].offTrackCount,
      reversed_count: 0,
      reset_count: TEST_EVALUATION_ITEM.metrics[2].resetCount,
      trial: TEST_EVALUATION_ITEM.metrics[2].trial,
    },
  ],
};
