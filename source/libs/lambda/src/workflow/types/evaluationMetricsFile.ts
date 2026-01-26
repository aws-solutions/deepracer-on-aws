// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EpisodeStatus } from '@deepracer-indy/typescript-server-client';

/**
 * EvaluationMetricsFile format as written in SimApp.
 */
export interface EvaluationMetricsFile {
  metrics: {
    completion_percentage: number;
    crash_count: number;
    elapsed_time_in_milliseconds: number;
    episode_status: EpisodeStatus;
    immobilized_count: number;
    metric_time: number;
    off_track_count: number;
    reset_count: number;
    reversed_count: number;
    start_time: number;
    trial: number;
  }[];
}
