// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface SimulationEnvironmentVariables {
  /** awsRegion */
  AWS_REGION: string;
  /** jobAccountId */
  ROBOMAKER_SIMULATION_JOB_ACCOUNT_ID: string;
  /** jobType */
  JOB_TYPE: string;
  /** trackName */
  WORLD_NAME: string;
  /** trackDirection */
  TRACK_DIRECTION_CLOCKWISE: boolean;
  /** changeStartPosition */
  CHANGE_START_POSITION: boolean;
  /** alternateDrivingDirection */
  ALTERNATE_DRIVING_DIRECTION: boolean;

  /** trainingJobArn */
  TRAINING_JOB_ARN: string;
  /** trainingMetricName */
  METRIC_NAME: string;
  /** trainingMetricNamespace */
  METRIC_NAMESPACE: string;
  /** targetRewardScore */
  TARGET_REWARD_SCORE: number;
  /** numOfEpisodes */
  NUMBER_OF_EPISODES: number;

  // Training specific s3 variables
  /** sageMakerSharedS3Bucket */
  SAGEMAKER_SHARED_S3_BUCKET: string;
  /** sageMakerSharedS3Key */
  SAGEMAKER_SHARED_S3_PREFIX: string;
  /** rewardFunctionS3Key */
  REWARD_FILE_S3_KEY: string;
  /** modelMetadataS3Key */
  MODEL_METADATA_FILE_S3_KEY: string;

  /** modelS3Buckets */
  MODEL_S3_BUCKET: string;
  /** modelS3Keys */
  MODEL_S3_PREFIX: string;
  /** metricsS3Buckets */
  METRICS_S3_BUCKET: string;
  /** metricsS3Keys */
  METRICS_S3_OBJECT_KEY: string;
  /** videoS3Buckets */
  MP4_S3_BUCKET: string;
  /** videoS3Keys */
  MP4_S3_OBJECT_PREFIX: string;
  /** simTraceS3Buckets */
  SIMTRACE_S3_BUCKET: string;
  /** simTraceS3Keys */
  SIMTRACE_S3_PREFIX: string;

  /** policyModelS3Bucket */
  POLICY_MODEL_SAGEMAKER_S3_PREFIX: string;
  /** policyModelS3Key */
  POLICY_MODEL_S3_BUCKET: string;
  /** kmsCmkArn */
  S3_KMS_CMK_ARN: string;

  /** numOfTrials */
  NUMBER_OF_TRIALS: number;

  // Kinesis Video Stream variables
  /** kvsName */
  KINESIS_VIDEO_STREAM_NAME: string;
  /** videoJobType */
  VIDEO_JOB_TYPE: string;
  /** modelNames */
  MODEL_NAME: string;

  /** racerAliases */
  RACER_NAME: string;
  /** leaderboardType */
  LEADERBOARD_TYPE: string;
  /** leaderboardName */
  LEADERBOARD_NAME: string;

  // Car customisation parameters
  /** carColors */
  CAR_COLOR: string;
  /** carShells */
  BODY_SHELL_TYPE: string;
  /** topDecal */
  CAR_TOP_DECAL: string;
  /** sideDecal */
  CAR_SIDES_DECAL: string;
  /** backDecal */
  CAR_BACK_DECAL: string;

  // Resetting behaviour parameters
  /** isContinuous */
  IS_CONTINUOUS: boolean;
  /** maxNumberOfResets */
  NUMBER_OF_RESETS: number;
  /** cutOffSeconds */
  CUT_OFF_SECONDS?: number;
  /** penaltySeconds */
  PENALTY_SECONDS?: number;
  /** collisionPenaltySeconds */
  COLLISION_PENALTY?: number;
  /** offTrackPenaltySeconds */
  OFF_TRACK_PENALTY?: number;

  /** raceType */
  RACE_TYPE: string;

  // OA parameters
  /** obstacleType */
  OBSTACLE_TYPE: string;
  /** numOfObstacles */
  NUMBER_OF_OBSTACLES: number;
  /** startPositionOffset */
  START_POS_OFFSET: number;
  /** reverseDirection */
  REVERSE_DIR: boolean;
  /** randomizeObstacleLocations */
  RANDOMIZE_OBSTACLE_LOCATIONS: boolean;

  /** obstaclePositions */
  OBJECT_POSITIONS: string[];
  /** isObstacleBotCar */
  IS_OBSTACLE_BOT_CAR: boolean;
}
