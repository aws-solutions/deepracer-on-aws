// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EpisodeStatus, Hyperparameters, RaceType } from '@deepracer-indy/typescript-server-client';

import { ActionSpaceType, SIM_APP_VERSION } from '../../workflow/constants/simulation.js';
import type { EvaluationMetricsFile } from '../../workflow/types/evaluationMetricsFile.js';
import type { ModelMetadataFile } from '../../workflow/types/modelMetadataFile.js';
import type { SimulationEnvironmentVariables } from '../../workflow/types/simulationEnvironmentVariables.js';

const mockS3Bucket = 'test-bucket';
const mockAccountId = '123456789012';
const mockKmsKeyArn = 'arn:aws:kms:us-east-1:123456789012:key/test-key';
const mockTrainingJobArn = 'arn:aws:sagemaker:us-east-1:123456789012:training-job/test-job';

export const mockModelMetadata: ModelMetadataFile = {
  action_space: {
    speed: {
      high: 4.0,
      low: 1.0,
    },
    steering_angle: {
      high: 30.0,
      low: -30.0,
    },
  },
  action_space_type: ActionSpaceType.CONTINUOUS,
  neural_network: 'DEEP_CONVOLUTIONAL_NETWORK_SHALLOW',
  sensor: ['FRONT_FACING_CAMERA'],
  training_algorithm: 'clipped_ppo',
  version: SIM_APP_VERSION,
};

export const mockDiscreteModelMetadata: ModelMetadataFile = {
  action_space: [
    { speed: 1.0, steering_angle: -30.0 },
    { speed: 2.0, steering_angle: 0.0 },
    { speed: 3.0, steering_angle: 30.0 },
  ],
  action_space_type: ActionSpaceType.DISCRETE,
  neural_network: 'DEEP_CONVOLUTIONAL_NETWORK_SHALLOW',
  sensor: ['FRONT_FACING_CAMERA', 'LIDAR'],
  training_algorithm: 'sac',
  version: SIM_APP_VERSION,
};

export const mockHyperparameters: Hyperparameters = {
  batch_size: 64,
  beta_entropy: 0.01,
  discount_factor: 0.999,
  e_greedy_value: 0.05,
  epsilon_steps: 10000,
  exploration_type: 'categorical',
  loss_type: 'huber',
  lr: 0.0003,
  num_episodes_between_training: 20,
  num_epochs: 10,
  stack_size: 1,
};

export const mockTrainingParams: SimulationEnvironmentVariables = {
  AWS_REGION: 'us-east-1',
  ROBOMAKER_SIMULATION_JOB_ACCOUNT_ID: mockAccountId,
  JOB_TYPE: 'TRAINING',
  WORLD_NAME: 'reinvent_base',
  TRACK_DIRECTION_CLOCKWISE: true,
  CHANGE_START_POSITION: false,
  ALTERNATE_DRIVING_DIRECTION: false,
  TRAINING_JOB_ARN: mockTrainingJobArn,
  METRIC_NAME: 'reward_score',
  METRIC_NAMESPACE: 'AWS/DeepRacer',
  TARGET_REWARD_SCORE: 100,
  NUMBER_OF_EPISODES: 100,
  SAGEMAKER_SHARED_S3_BUCKET: mockS3Bucket,
  SAGEMAKER_SHARED_S3_PREFIX: 'test-prefix',
  REWARD_FILE_S3_KEY: 'reward.py',
  MODEL_METADATA_FILE_S3_KEY: 'model_metadata.json',
  MODEL_S3_BUCKET: mockS3Bucket,
  MODEL_S3_PREFIX: 'model',
  METRICS_S3_BUCKET: mockS3Bucket,
  METRICS_S3_OBJECT_KEY: 'metrics.json',
  MP4_S3_BUCKET: mockS3Bucket,
  MP4_S3_OBJECT_PREFIX: 'video',
  SIMTRACE_S3_BUCKET: mockS3Bucket,
  SIMTRACE_S3_PREFIX: 'simtrace',
  POLICY_MODEL_SAGEMAKER_S3_PREFIX: 'policy',
  POLICY_MODEL_S3_BUCKET: mockS3Bucket,
  S3_KMS_CMK_ARN: mockKmsKeyArn,
  NUMBER_OF_TRIALS: 3,
  KINESIS_VIDEO_STREAM_NAME: 'test-stream',
  VIDEO_JOB_TYPE: 'EVALUATION',
  MODEL_NAME: 'test-model',
  RACER_NAME: 'test-racer',
  LEADERBOARD_TYPE: 'COMMUNITY',
  LEADERBOARD_NAME: 'test-leaderboard',
  CAR_COLOR: 'white',
  BODY_SHELL_TYPE: 'deepracer',
  CAR_TOP_DECAL: '',
  CAR_SIDES_DECAL: '',
  CAR_BACK_DECAL: '',
  IS_CONTINUOUS: false,
  NUMBER_OF_RESETS: 0,
  RACE_TYPE: RaceType.TIME_TRIAL,
  OBSTACLE_TYPE: 'BOX',
  NUMBER_OF_OBSTACLES: 0,
  START_POS_OFFSET: 0,
  REVERSE_DIR: false,
  RANDOMIZE_OBSTACLE_LOCATIONS: false,
  OBJECT_POSITIONS: [],
  IS_OBSTACLE_BOT_CAR: false,
};

export const mockRewardFunction = `
      def reward_function(params):
          track_width = params['track_width']
          distance_from_center = params['distance_from_center']

          marker_1 = 0.1 * track_width
          marker_2 = 0.25 * track_width
          marker_3 = 0.5 * track_width

          if distance_from_center <= marker_1:
              reward = 1.0
          elif distance_from_center <= marker_2:
              reward = 0.5
          elif distance_from_center <= marker_3:
              reward = 0.1
          else:
              reward = 1e-3

          return float(reward)`;

export const mockMetrics: EvaluationMetricsFile = {
  metrics: [
    {
      completion_percentage: 85.5,
      crash_count: 2,
      elapsed_time_in_milliseconds: 15000,
      episode_status: EpisodeStatus.LAP_COMPLETE,
      immobilized_count: 0,
      metric_time: 1640995200,
      off_track_count: 1,
      reset_count: 3,
      reversed_count: 0,
      start_time: 1640995185,
      trial: 1,
    },
  ],
};

export const mockContextConstants = {
  awsRequestId: 'test-request-id',
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'testFunction',
  functionVersion: '$LATEST',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/testFunction',
  logStreamName: '2025/04/10/[$LATEST]abcdef1234567890',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:testFunction',
  getRemainingTimeInMillis: () => 30000,
};

export const testConstants = {
  s3: {
    sourceBucket: 'source-bucket',
    sourcePrefix: 'source-prefix',
    destBucket: 'dest-bucket',
    destPrefix: 'dest-prefix',
  },
  paths: {
    modelMetadata: '/model_metadata.json',
    rewardFunction: '/reward_function.py',
    hyperparameters: '/ip/hyperparameters.json',
    trainingParams: '/training_params.yaml',
    metricsTraining: '/metrics/training/',
  },
  ids: {
    profile: 'profile-123',
    model: 'model-456',
  },
  trackName: 'oval_track_cw',
};
