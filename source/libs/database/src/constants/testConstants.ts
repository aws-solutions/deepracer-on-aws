// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  AgentAlgorithm,
  CameraSensor,
  CarColor,
  CarShell,
  EpisodeStatus,
  EvaluationConfig,
  ExplorationType,
  JobStatus,
  LidarSensor,
  LossType,
  ModelStatus,
  NotFoundError,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';

import { ErrorMessage } from './errorMessages.js';
import { DynamoDBItemAttribute } from './itemAttributes.js';
import { JobType } from './jobType.js';
import type { AccountResourceUsageItem } from '../entities/AccountResourceUsageEntity.js';
import type { EvaluationItem } from '../entities/EvaluationsEntity.js';
import type { LeaderboardItem } from '../entities/LeaderboardsEntity.js';
import type { ModelItem, ModelsEntity } from '../entities/ModelsEntity.js';
import type { ProfileItem } from '../entities/ProfilesEntity.js';
import type { RankingItem } from '../entities/RankingsEntity.js';
import type { SubmissionItem } from '../entities/SubmissionsEntity.js';
import type { TrainingItem } from '../entities/TrainingsEntity.js';
import type { JobItem } from '../types/jobItem.js';
import { generateResourceId } from '../utils/resourceUtils.js';

export const TEST_TABLE_NAME = 'TestTable';
export const TEST_CURSOR = 'testCursor';
export const TEST_NAMESPACE = 'test';

export const TEST_CREATE_MODEL_PARAMS = {
  [DynamoDBItemAttribute.CAR_CUSTOMIZATION]: {
    carColor: CarColor.BLACK,
    carShell: CarShell.DEEPRACER,
  },
  [DynamoDBItemAttribute.DESCRIPTION]: 'modelDescription',
  [DynamoDBItemAttribute.METADATA]: {
    agentAlgorithm: AgentAlgorithm.PPO,
    rewardFunction: 'testRewardFunctionString',
    hyperparameters: {
      batch_size: 64,
      lr: 0.0003,
      discount_factor: 0.99,
      loss_type: LossType.HUBER,
      num_episodes_between_training: 20,
      exploration_type: ExplorationType.CATEGORICAL,
    },
    actionSpace: {
      continous: {
        highSpeed: 5,
        highSteeringAngle: 6,
        lowSpeed: 4,
        lowSteeringAngle: 4,
      },
    },
    sensors: {
      camera: CameraSensor.FRONT_FACING_CAMERA,
      lidar: LidarSensor.DISCRETIZED_SECTOR_LIDAR,
    },
  },
  [DynamoDBItemAttribute.NAME]: 'testModelName',
  [DynamoDBItemAttribute.STATUS]: ModelStatus.QUEUED,
} satisfies Omit<Parameters<ModelsEntity['create']>[0], 'profileId'>;

export const TEST_EVALUATION_ID_1 = generateResourceId();
export const TEST_EVALUATION_ID_2 = generateResourceId();
export const TEST_EVALUATION_ID_3 = generateResourceId();
export const TEST_EVALUATION_ID_4 = generateResourceId();
export const TEST_LEADERBOARD_ID = generateResourceId();
export const TEST_LEADERBOARD_ID_2 = generateResourceId();
export const TEST_LEADERBOARD_ID_3 = generateResourceId();
export const TEST_MODEL_ID_1 = generateResourceId();
export const TEST_MODEL_ID_2 = generateResourceId();
export const TEST_MODEL_ID_3 = generateResourceId();
export const TEST_MODEL_ID_4 = generateResourceId();
export const TEST_PROFILE_ID_1 = generateResourceId();
export const TEST_PROFILE_ID_2 = generateResourceId();
export const TEST_PROFILE_ID_3 = generateResourceId();
export const TEST_SUBMISSION_ID_1 = generateResourceId();
export const TEST_SUBMISSION_ID_2 = generateResourceId();
export const TEST_SUBMISSION_ID_3 = generateResourceId();
export const TEST_TRAINING_JOB_ID_1 = generateResourceId();
export const TEST_TRAINING_JOB_ID_2 = generateResourceId();
export const TEST_TIMESTAMP = new Date().toISOString();

export const TEST_ITEM_NOT_FOUND_ERROR = new NotFoundError({ message: ErrorMessage.ITEM_NOT_FOUND });

const TEST_JOB_ASSET_S3_LOCATIONS: JobItem['assetS3Locations'] = {
  metricsS3Location: 's3://modelBucket/profileId/models/modelId/metrics/jobType/timeStamp-jobName.json',
  simTraceS3Location: 's3://modelBucket/profileId/models/modelId/sim-trace/jobType/timestamp-jobName/',
  simulationHeartbeatS3Location:
    's3://modelBucket/profileId/models/modelId/sagemaker-artifacts/jobType_job_status.json',
  simulationYamlS3Location: 's3://modelBucket/profileId/models/modelId/sagemaker-artifacts/training_params.yaml',
  videosS3Location: 's3://modelBucket/profileId/models/modelId/videos/jobType/timeStamp-jobName/',
  simulationLogsS3Location: 's3://modelBucket/profileId/models/modelId/logs/jobType/simulation.log',
  primaryVideoS3Location:
    's3://modelBucket/profileId/models/modelId/videos/jobType/timeStamp-jobName/camera-pip/0-video.mp4',
};

export const TEST_MODEL_ITEM: ModelItem = {
  name: 'Test Model',
  carCustomization: {
    carColor: CarColor.WHITE,
    carShell: CarShell.MARS_ROVER,
  },
  metadata: {
    agentAlgorithm: AgentAlgorithm.PPO,
    rewardFunction: 'reward function code',
    hyperparameters: {
      batch_size: 64,
      lr: 0.0003,
      discount_factor: 0.99,
      loss_type: LossType.HUBER,
      num_episodes_between_training: 20,
      exploration_type: ExplorationType.CATEGORICAL,
    },
    actionSpace: {
      discrete: [{ speed: 1, steeringAngle: 10 }],
    },
    sensors: {
      camera: CameraSensor.FRONT_FACING_CAMERA,
      lidar: LidarSensor.DISCRETIZED_SECTOR_LIDAR,
    },
  },
  modelId: TEST_MODEL_ID_1,
  profileId: TEST_PROFILE_ID_1,
  updatedAt: TEST_TIMESTAMP,
  createdAt: TEST_TIMESTAMP,
  packagedAt: TEST_TIMESTAMP,
  packagingStatus: ModelStatus.QUEUED,
  fileSizeInBytes: 120,
  status: ModelStatus.QUEUED,
  description: 'Test model for unit test',
  importErrorMessage: undefined,
  assetS3Locations: {
    modelArtifactS3Location:
      's3://modelBucket/profileId/models/modelId/sagemaker-artifacts/deepracerindy-training-123/output/model.tar.gz',
    modelMetadataS3Location: 's3://modelBucket/profileId/models/modelId/model_metadata.json',
    modelRootS3Location: 's3://modelBucket/profileId/models/modelId/',
    rewardFunctionS3Location: 's3://modelBucket/profileId/models/modelId/reward_function.py',
    sageMakerArtifactsS3Location: 's3://modelBucket/profileId/models/modelId/sagemaker-artifacts/',
    virtualModelArtifactS3Location: 's3://modelBucket/profileId/models/modelId/sagemaker-artifacts/virtualmodel.zip',
  },
};

export const TEST_PROFILE_ITEM: ProfileItem = {
  alias: 'testAlias',
  avatar: {
    top: 'top',
  },
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  profileId: TEST_PROFILE_ID_1,
  computeMinutesUsed: 0,
  computeMinutesQueued: 0,
  maxTotalComputeMinutes: -1,
  modelCount: 0,
  maxModelCount: -1,
};

export const TEST_PROFILE_ITEM_WITH_LIMITS: ProfileItem = {
  ...TEST_PROFILE_ITEM,
  avatar: {
    top: 'top',
  },
  maxTotalComputeMinutes: 600,
  maxModelCount: 10,
};

export const TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS: ProfileItem = {
  ...TEST_PROFILE_ITEM,
  avatar: {
    top: 'top',
  },
  computeMinutesUsed: 300,
  computeMinutesQueued: 100,
  maxTotalComputeMinutes: 600,
  maxModelCount: 10,
};

export const TEST_PROFILE_ITEM_WITH_UNDEFINED_USAGE_AND_LIMITS: ProfileItem = {
  ...TEST_PROFILE_ITEM,
  avatar: {
    top: 'top',
  },
  computeMinutesUsed: undefined,
  computeMinutesQueued: undefined,
  maxTotalComputeMinutes: undefined,
  maxModelCount: undefined,
};

export const TEST_TRAINING_ITEM = {
  modelId: TEST_MODEL_ID_1,
  status: JobStatus.QUEUED,
  raceType: RaceType.TIME_TRIAL,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  profileId: TEST_PROFILE_ID_1,
  name: `deepracerindy-training-${TEST_MODEL_ID_1}`,
  sageMakerJobArn: `arn:aws:sagemaker:us-east-1:accountid:training-job/deepracerindy-training-${TEST_MODEL_ID_1}`,
  terminationConditions: {
    maxTimeInMinutes: 15,
  },
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  assetS3Locations: {
    ...TEST_JOB_ASSET_S3_LOCATIONS,
    trainingLogsS3Location: 's3://modelBucket/profileId/models/modelId/logs/jobType/training.log',
  },
  videoStreamUrl: 'https://mock-training-video-stream-url',
} satisfies TrainingItem;

export const TEST_TRAINING_ITEM_OA = {
  ...TEST_TRAINING_ITEM,
  raceType: RaceType.OBJECT_AVOIDANCE,
  objectAvoidanceConfig: { numberOfObjects: 5 },
} satisfies TrainingItem;

export const TEST_EVALUATION_ITEM = {
  modelId: TEST_MODEL_ID_1,
  status: JobStatus.QUEUED,
  profileId: TEST_PROFILE_ID_1,
  evaluationId: TEST_EVALUATION_ID_1,
  evaluationName: 'test-evaluation',
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  name: `deepracerindy-evaluation-${TEST_EVALUATION_ID_1}`,
  metrics: [
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 36682,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      crashCount: 0,
      offTrackCount: 6,
      resetCount: 6,
      trial: 1,
    },
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 40731,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      crashCount: 0,
      offTrackCount: 8,
      resetCount: 8,
      trial: 2,
    },
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 42859,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      crashCount: 0,
      offTrackCount: 9,
      resetCount: 9,
      trial: 3,
    },
  ],
  raceType: RaceType.TIME_TRIAL,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  sageMakerJobArn: `arn:aws:sagemaker:us-east-1:accountid:training-job/deepracerindy-evaluation-${TEST_MODEL_ID_1}`,
  terminationConditions: {
    maxLaps: 5,
    maxTimeInMinutes: 5,
  },
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  assetS3Locations: TEST_JOB_ASSET_S3_LOCATIONS,
} satisfies EvaluationItem;

export const TEST_EVALUATION_ITEM_OA = {
  ...TEST_EVALUATION_ITEM,
  raceType: RaceType.OBJECT_AVOIDANCE,
  objectAvoidanceConfig: {
    numberOfObjects: 5,
  },
  videoStreamUrl: 'https://mock-video-stream-url',
} satisfies EvaluationItem;

export const TEST_EVALUATION_CONFIG: EvaluationConfig = {
  evaluationName: 'test-evaluation',
  maxLaps: 2,
  maxTimeInMinutes: 10,
  raceType: RaceType.TIME_TRIAL,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  trackConfig: {
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
    trackId: TrackId.ACE_SPEEDWAY,
  },
};

export const TEST_SUBMISSION_ITEM = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  status: JobStatus.QUEUED,
  modelName: TEST_MODEL_ITEM.name,
  name: `deepracerindy-submission-${TEST_SUBMISSION_ID_1}`,
  profileId: TEST_PROFILE_ID_1,
  leaderboardId: TEST_LEADERBOARD_ID,
  modelId: TEST_MODEL_ID_1,
  sageMakerJobArn: `arn:aws:sagemaker:us-east-1:accountid:training-job/deepracerindy-submission-${TEST_MODEL_ID_1}`,
  submissionId: TEST_SUBMISSION_ID_1,
  submissionNumber: 1,
  raceType: RaceType.TIME_TRIAL,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  terminationConditions: {
    maxTimeInMinutes: 5,
    maxLaps: 5,
  },
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  assetS3Locations: TEST_JOB_ASSET_S3_LOCATIONS,
  videoStreamUrl: 'https://mock-video-stream-url',
} satisfies SubmissionItem;

export const TEST_LEADERBOARD_ITEM: LeaderboardItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  name: `deepracerindy-test-${TEST_LEADERBOARD_ID}`,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  raceType: RaceType.TIME_TRIAL,
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  closeTime: TEST_TIMESTAMP,
  leaderboardId: TEST_LEADERBOARD_ID,
  maxSubmissionsPerUser: 5,
  minimumLaps: 2,
  openTime: TEST_TIMESTAMP,
  participantCount: 10,
  submissionTerminationConditions: {
    maxLaps: 3,
    maxTimeInMinutes: 10,
  },
  timingMethod: TimingMethod.AVG_LAP_TIME,
};

export const TEST_LEADERBOARD_ITEM_OA: LeaderboardItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  name: `deepracerindy-test-${TEST_LEADERBOARD_ID}-2`,
  resettingBehaviorConfig: {
    continuousLap: true,
    collisionPenaltySeconds: 1,
    offTrackPenaltySeconds: 1,
  },
  raceType: RaceType.OBJECT_AVOIDANCE,
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  objectAvoidanceConfig: {
    numberOfObjects: 2,
    objectPositions: [
      { laneNumber: -1, trackPercentage: 0.1 },
      { laneNumber: -1, trackPercentage: 0.3 },
    ],
  },
  closeTime: TEST_TIMESTAMP,
  leaderboardId: TEST_LEADERBOARD_ID,
  maxSubmissionsPerUser: 5,
  minimumLaps: 2,
  openTime: TEST_TIMESTAMP,
  participantCount: 10,
  submissionTerminationConditions: {
    maxLaps: 3,
    maxTimeInMinutes: 10,
  },
  timingMethod: TimingMethod.AVG_LAP_TIME,
};

export const TEST_MODEL_ITEMS: ModelItem[] = [
  {
    ...TEST_MODEL_ITEM,
    name: 'Test Model 1',
    modelId: TEST_MODEL_ID_1,
    createdAt: '2024-08-15T17:28:52.188Z',
    fileSizeInBytes: 120,
    status: ModelStatus.QUEUED,
    importErrorMessage: undefined,
  },
  {
    ...TEST_MODEL_ITEM,
    name: 'Test Model 2',
    modelId: TEST_MODEL_ID_2,
    createdAt: '2024-08-15T17:28:52.188Z',
    fileSizeInBytes: 12,
    status: ModelStatus.READY,
    importErrorMessage: undefined,
  },
  {
    ...TEST_MODEL_ITEM,
    name: 'Test Model 3',
    modelId: TEST_MODEL_ID_3,
    createdAt: '2024-08-15T17:28:52.188Z',
    fileSizeInBytes: 70,
    importErrorMessage: undefined,
    status: ModelStatus.DELETING,
  },
  {
    ...TEST_MODEL_ITEM,
    name: 'Test Model 4',
    modelId: TEST_MODEL_ID_4,
    createdAt: '2024-08-15T17:28:52.188Z',
    fileSizeInBytes: 70,
    status: ModelStatus.ERROR,
    importErrorMessage: 'Model Validation Failed: No checkpoint files',
  },
];

export const TEST_TRAINING_ITEMS: TrainingItem[] = [
  {
    ...TEST_TRAINING_ITEM,
    modelId: TEST_MODEL_ID_1,
    status: JobStatus.COMPLETED,
  },
  {
    ...TEST_TRAINING_ITEM,
    modelId: TEST_MODEL_ID_2,
    status: JobStatus.COMPLETED,
  },
  {
    ...TEST_TRAINING_ITEM,
    modelId: TEST_MODEL_ID_3,
    status: JobStatus.IN_PROGRESS,
  },
  {
    ...TEST_TRAINING_ITEM,
    modelId: TEST_MODEL_ID_4,
    status: JobStatus.COMPLETED,
  },
];

export const TEST_EVALUATION_ITEMS: EvaluationItem[] = [
  { ...TEST_EVALUATION_ITEM, status: JobStatus.COMPLETED, evaluationId: TEST_EVALUATION_ID_1 },
  {
    ...TEST_EVALUATION_ITEM,
    status: JobStatus.COMPLETED,
    evaluationId: TEST_EVALUATION_ID_2,
    evaluationName: 'test-evaluation-2',
  },
  {
    ...TEST_EVALUATION_ITEM,
    status: JobStatus.QUEUED,
    evaluationId: TEST_EVALUATION_ID_3,
    evaluationName: 'test-evaluation-3',
    metrics: undefined,
  },
  {
    ...TEST_EVALUATION_ITEM,
    status: JobStatus.COMPLETED,
    evaluationId: TEST_EVALUATION_ID_4,
    evaluationName: 'test-evaluation-4',
    metrics: undefined,
  },
];

export const TEST_SUBMISSION_ITEMS: SubmissionItem[] = [
  {
    ...TEST_SUBMISSION_ITEM,
    createdAt: '2024-08-17T17:28:52.188Z',
    status: JobStatus.COMPLETED,
    submissionId: TEST_SUBMISSION_ID_1,
    submissionNumber: 1,
    stats: {
      avgLapTime: 10000,
      avgResets: 30,
      bestLapTime: 200,
      collisionCount: 4,
      completedLapCount: 3,
      offTrackCount: 15,
      resetCount: 7,
      totalLapTime: 30000,
    },
  },
  {
    ...TEST_SUBMISSION_ITEM,
    createdAt: '2024-08-16T17:28:52.188Z',
    status: JobStatus.COMPLETED,
    submissionId: TEST_SUBMISSION_ID_2,
    submissionNumber: 2,
    stats: {
      avgLapTime: 5000,
      avgResets: 48,
      bestLapTime: 20100,
      collisionCount: 14,
      completedLapCount: 5,
      offTrackCount: 35,
      resetCount: 13,
      totalLapTime: 27000,
    },
  },
  {
    ...TEST_SUBMISSION_ITEM,
    createdAt: '2024-08-15T17:28:52.188Z',
    status: JobStatus.IN_PROGRESS,
    submissionId: TEST_SUBMISSION_ID_3,
    submissionNumber: 3,
  },
];

export const TEST_LEADERBOARD_ITEMS: LeaderboardItem[] = [
  { ...TEST_LEADERBOARD_ITEM, leaderboardId: TEST_LEADERBOARD_ID },
  { ...TEST_LEADERBOARD_ITEM, leaderboardId: TEST_LEADERBOARD_ID_2 },
  { ...TEST_LEADERBOARD_ITEM, leaderboardId: TEST_LEADERBOARD_ID_3 },
];

export const TEST_JOB_ITEM_MAP = {
  [JobType.EVALUATION]: TEST_EVALUATION_ITEM,
  [JobType.SUBMISSION]: TEST_SUBMISSION_ITEM,
  [JobType.TRAINING]: TEST_TRAINING_ITEM,
};

export const TEST_RANKING_ITEM: RankingItem = {
  userProfile: {
    avatar: {
      accessories: 'testAccessories',
    },
    alias: 'testAlias',
  },
  submissionNumber: 2,
  submissionId: TEST_SUBMISSION_ITEM.submissionId,
  rankingScore: 2000,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  stats: {
    avgLapTime: 15,
    bestLapTime: 15,
    totalLapTime: 15,
    avgResets: 15,
    completedLapCount: 15,
    collisionCount: 15,
    offTrackCount: 15,
    resetCount: 15,
  },
  profileId: TEST_PROFILE_ITEM.profileId,
  leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
  modelId: TEST_MODEL_ITEM.modelId,
  modelName: TEST_MODEL_ITEM.name,
  submissionVideoS3Location:
    's3://modelBucket/profileId/models/modelId/videos/jobType/timeStamp-jobName/camera-pip/0-video.mp4',
};

export const TEST_RANKING_ITEMS: RankingItem[] = [
  TEST_RANKING_ITEM,
  {
    ...TEST_RANKING_ITEM,
    userProfile: {
      ...TEST_RANKING_ITEM.userProfile,
      alias: 'testAlias2',
    },
    submissionId: TEST_SUBMISSION_ID_2,
    submissionNumber: 5,
    rankingScore: 300,
    stats: {
      avgLapTime: 10,
      bestLapTime: 10,
      totalLapTime: 10,
      avgResets: 10,
      completedLapCount: 10,
      collisionCount: 10,
      offTrackCount: 10,
      resetCount: 10,
    },
    profileId: TEST_PROFILE_ID_2,
    modelId: TEST_MODEL_ID_2,
  },
  {
    ...TEST_RANKING_ITEM,
    userProfile: {
      ...TEST_RANKING_ITEM.userProfile,
      alias: 'testAlias3',
    },
    submissionNumber: 7,
    submissionId: TEST_SUBMISSION_ID_3,
    rankingScore: 600,
    stats: {
      avgLapTime: 152,
      bestLapTime: 152,
      totalLapTime: 152,
      avgResets: 15,
      completedLapCount: 15,
      collisionCount: 15,
      offTrackCount: 15,
      resetCount: 15,
    },
    profileId: TEST_PROFILE_ID_3,
    modelId: TEST_MODEL_ID_3,
  },
];

export const TEST_ACCOUNT_RESOURCE_USAGE_EMPTY: AccountResourceUsageItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  accountComputeMinutesUsed: 0,
  accountComputeMinutesQueued: 0,
};

export const TEST_ACCOUNT_RESOURCE_USAGE_MAX: AccountResourceUsageItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  accountComputeMinutesUsed: 58000,
  accountComputeMinutesQueued: 2000,
};

export const TEST_ACCOUNT_RESOURCE_USAGE_NORMAL: AccountResourceUsageItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  accountComputeMinutesUsed: 400,
  accountComputeMinutesQueued: 0,
};

export const TEST_ACCOUNT_RESOURCE_USAGE_NORMAL2: AccountResourceUsageItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  accountComputeMinutesUsed: 400,
  accountComputeMinutesQueued: 300,
};

export const TEST_GLOBAL_CONFIG_NEW_USER = {
  newUserComputeMinutesLimit: 10,
  newUserModelCountLimit: 10,
};
