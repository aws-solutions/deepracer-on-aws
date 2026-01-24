// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EpisodeStatus } from '@deepracer-indy/typescript-client';

export interface TrainingMetric {
  completion_percentage: number;
  elapsed_time_in_milliseconds: number;
  episode_status: EpisodeStatus;
  episode: number;
  metric_time: number;
  phase: 'evaluation' | 'training';
  reward_score: number;
  start_time: number;
  trial: number;
}
