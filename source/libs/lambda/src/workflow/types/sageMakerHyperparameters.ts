// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { JobName } from '@deepracer-indy/database';
import type { TrackId } from '@deepracer-indy/typescript-server-client';

import type { SimulationLaunchFile } from '../constants/simulation.js';

export interface SageMakerHyperparameters {
  aws_region: string;
  heartbeat_s3_location: string; // Helps the SimApp to monitor the job status
  kinesis_stream_name: JobName;
  model_metadata_s3_key: string;
  pretrained_s3_bucket?: string;
  pretrained_s3_prefix?: string;
  reward_function_s3_source: string;
  s3_bucket: string;
  s3_kms_cmk_arn?: string;
  s3_prefix: string;
  s3_ros_log_bucket: string;
  s3_yaml_name: string;
  simulation_launch_file: (typeof SimulationLaunchFile)[keyof typeof SimulationLaunchFile];
  track_direction_clockwise: string;
  world_name: TrackId;
}
