// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AgentAlgorithm,
  CameraSensor,
  CarColor,
  CarShell,
  EpisodeStatus,
  Evaluation,
  ExplorationType,
  JobStatus,
  Leaderboard,
  LidarSensor,
  LossType,
  Model,
  ModelStatus,
  PersonalRanking,
  Profile,
  RaceType,
  Ranking,
  Submission,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-client';

export const mockRankings: Ranking[] = [
  {
    submittedAt: new Date('2016-3-17'),
    stats: {
      avgLapTime: 30,
      avgResets: 20,
      bestLapTime: 20,
      collisionCount: 2,
      completedLapCount: 1,
      offTrackCount: 2,
      resetCount: 2,
      totalLapTime: 40,
    },
    submissionNumber: 2,
    videoUrl: 'https://mock-submission-video-url',
    rank: 1,
    rankingScore: 20,
    userProfile: {
      alias: 'racer1',
      avatar: {},
    },
  },
  {
    submittedAt: new Date('2016-3-17'),
    stats: {
      avgLapTime: 30,
      avgResets: 20,
      bestLapTime: 200010,
      collisionCount: 2,
      completedLapCount: 1,
      offTrackCount: 7,
      resetCount: 2,
      totalLapTime: 40,
    },
    submissionNumber: 8,
    videoUrl: 'https://mock-submission-video-url',
    rank: 2,
    rankingScore: 200010,
    userProfile: {
      alias: 'racer2',
      avatar: {},
    },
  },
  {
    submittedAt: new Date('2016-3-17'),
    stats: {
      avgLapTime: 30,
      avgResets: 20,
      bestLapTime: 200020,
      collisionCount: 2,
      completedLapCount: 1,
      offTrackCount: 10,
      resetCount: 2,
      totalLapTime: 40,
    },
    submissionNumber: 1,
    videoUrl: 'https://mock-submission-video-url',
    rank: 3,
    rankingScore: 200020,
    userProfile: {
      alias: 'racer3',
      avatar: {},
    },
  },
];

export const mockProfile: Profile = {
  alias: 'testRacerAlias',
  avatar: {
    clothing: 'GraphicShirt',
    clothingColor: 'PastelGreen',
    facialHair: 'BeardMajestic',
    facialHairColor: 'Brown',
    hairColor: 'Red',
    mouth: 'Tongue',
    skinColor: 'Brown',
    top: 'LongHairFro',
    tshirtGraphic: 'Diamond',
  },
  profileId: '123456789012345',
  computeMinutesUsed: 0,
  computeMinutesQueued: 0,
  maxTotalComputeMinutes: 600,
  maxModelCount: 10,
};

export const mockProfileNoAvatar: Profile = {
  alias: 'testRacerAlias',
  avatar: {},
  profileId: '123456789012345',
  computeMinutesUsed: 0,
  computeMinutesQueued: 0,
  maxTotalComputeMinutes: undefined,
  maxModelCount: undefined,
};

const MOCK_DATE_FUTURE = new Date(Date.now() + 500_000);
const MOCK_DATE_FUTURE_2 = new Date(Date.now() + 800_000);
const MOCK_DATE_PAST = new Date(Date.now() - 500_000);
const MOCK_DATE_PAST_2 = new Date(Date.now() - 800_000);

export const mockLeaderboardTT: Leaderboard = {
  name: 'Test-TT-Leaderboard',
  openTime: MOCK_DATE_PAST,
  closeTime: MOCK_DATE_FUTURE,
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  raceType: RaceType.TIME_TRIAL,
  leaderboardId: 'mockTTLeaderboard',
  participantCount: 4,
  resettingBehaviorConfig: {
    continuousLap: true,
    offTrackPenaltySeconds: 2,
  },
  submissionTerminationConditions: {
    minimumLaps: 1,
    maximumLaps: 3,
  },
  timingMethod: TimingMethod.BEST_LAP_TIME,
  maxSubmissionsPerUser: 10,
  description: 'This is a test Time Trial leaderboard description',
};

export const mockLeaderboardOA: Leaderboard = {
  name: 'Test-OA-Leaderboard',
  openTime: MOCK_DATE_PAST,
  closeTime: MOCK_DATE_FUTURE,
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  raceType: RaceType.OBJECT_AVOIDANCE,
  leaderboardId: 'mockOALeaderboard',
  participantCount: 10,
  objectAvoidanceConfig: {
    numberOfObjects: 10,
  },
  resettingBehaviorConfig: {
    continuousLap: true,
    offTrackPenaltySeconds: 2,
    collisionPenaltySeconds: 4,
  },
  submissionTerminationConditions: {
    minimumLaps: 1,
    maximumLaps: 3,
  },
  timingMethod: TimingMethod.BEST_LAP_TIME,
  maxSubmissionsPerUser: 10,
  description: 'This is a test Object Avoidance leaderboard description',
};

export const mockLeaderboardTTFuture: Leaderboard = {
  ...mockLeaderboardTT,
  openTime: MOCK_DATE_FUTURE,
  closeTime: MOCK_DATE_FUTURE_2,
  leaderboardId: 'mockTTLeaderboardFuture',
  name: 'Test-TT-Leaderboard-Future',
  trackConfig: {
    trackDirection: TrackDirection.CLOCKWISE,
    trackId: TrackId.FOREVER_RACEWAY,
  },
};

export const mockLeaderboardTTClosed: Leaderboard = {
  ...mockLeaderboardTT,
  openTime: MOCK_DATE_PAST_2,
  closeTime: MOCK_DATE_PAST,
  leaderboardId: 'mockTTLeaderboardClosed',
  name: 'Test-TT-Leaderboard-Closed',
  trackConfig: {
    trackDirection: TrackDirection.CLOCKWISE,
    trackId: TrackId.SHANGHAI_SUDU_TRAINING,
  },
};

export const mockLeaderboards = [mockLeaderboardTTFuture, mockLeaderboardOA, mockLeaderboardTTClosed];

export const mockSubmissions = [
  {
    submittedAt: new Date('2024-10-01'),
    submissionNumber: 1,
    modelId: 'testModel1',
    modelName: 'testModelName1',
    rankingScore: 5000,
    status: JobStatus.COMPLETED,
    stats: {
      avgLapTime: 30,
      avgResets: 20,
      bestLapTime: 200020,
      collisionCount: 2,
      completedLapCount: 1,
      offTrackCount: 2,
      resetCount: 2,
      totalLapTime: 40,
    },
    videoUrl: 'https://mock-submission-video-url',
  },
  {
    submittedAt: new Date('2024-10-10'),
    submissionNumber: 2,
    modelId: 'testModel2',
    modelName: 'testModelName2',
    status: JobStatus.IN_PROGRESS,
    videoUrl: 'https://mock-submission-video-url',
  },
  {
    submittedAt: new Date('2024-10-15'),
    submissionNumber: 3,
    modelId: 'testModel3',
    modelName: 'testModelName3',
    status: JobStatus.FAILED,
    videoUrl: 'https://mock-submission-video-url',
  },
] as const satisfies Submission[];

export const mockPersonalRanking: PersonalRanking = {
  modelId: mockSubmissions[0].modelId,
  modelName: mockSubmissions[0].modelName,
  rank: 5,
  rankingScore: mockSubmissions[0].rankingScore,
  stats: mockSubmissions[0].stats,
  submissionNumber: mockSubmissions[0].submissionNumber,
  submittedAt: mockSubmissions[0].submittedAt,
  videoUrl: mockSubmissions[0].videoUrl,
};

export const mockModel: Model = {
  name: 'testModel',
  carCustomization: {
    carColor: CarColor.RED,
    carShell: CarShell.DEEPRACER,
  },
  trainingConfig: {
    trackConfig: {
      trackId: TrackId.ACE_SPEEDWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    },
    maxTimeInMinutes: 20,
    raceType: RaceType.TIME_TRIAL,
  },
  modelId: 'testModel',
  metadata: {
    agentAlgorithm: AgentAlgorithm.PPO,
    rewardFunction: 'test reward function code',
    hyperparameters: {
      batch_size: 64,
      lr: 0.0003,
      discount_factor: 0.99,
      loss_type: LossType.HUBER,
      num_episodes_between_training: 20,
      exploration_type: ExplorationType.CATEGORICAL,
      e_greedy_value: 0.05,
    },
    sensors: {
      camera: CameraSensor.FRONT_FACING_CAMERA,
      lidar: LidarSensor.DISCRETIZED_SECTOR_LIDAR,
    },
    actionSpace: {
      continous: {
        lowSpeed: 0.5,
        lowSteeringAngle: -30,
        highSpeed: 1,
        highSteeringAngle: 30,
      },
    },
  },
  createdAt: new Date('2024-09-09'),
  fileSizeInBytes: 1321312,
  status: ModelStatus.READY,
  trainingStatus: JobStatus.COMPLETED,
  trainingMetricsUrl: 'https://mock-deepracer-on-aws.com/training-metrics/metrics.json',
  trainingVideoStreamUrl: 'https://mock-training-video-stream-url',
};

export const mockModel2: Model = {
  name: 'testModel2',
  carCustomization: {
    carColor: CarColor.BLACK,
    carShell: CarShell.DEEPRACER,
  },
  trainingConfig: {
    trackConfig: {
      trackId: TrackId.ACE_SPEEDWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    },
    maxTimeInMinutes: 20,
    raceType: RaceType.OBJECT_AVOIDANCE,
  },
  modelId: 'testModel2',
  metadata: {
    agentAlgorithm: AgentAlgorithm.PPO,
    rewardFunction: '',
    hyperparameters: {
      batch_size: 64,
      lr: 0.0003,
      discount_factor: 0.99,
      loss_type: LossType.HUBER,
      num_episodes_between_training: 20,
      exploration_type: ExplorationType.CATEGORICAL,
      e_greedy_value: 0.05,
    },
    sensors: {},
    actionSpace: {
      discrete: [],
    },
  },
  createdAt: new Date(),
  fileSizeInBytes: 1321312,
  status: ModelStatus.READY,
  trainingStatus: JobStatus.COMPLETED,
  trainingMetricsUrl: 'https://mock-deepracer-on-aws.com/training-metrics/metrics.json',
};

export const mockModel3: Model = {
  ...mockModel2,
  name: 'testModel3',
  modelId: 'testModel3',
  importErrorMessage: 'Model Validation Failed: No checkpoint files',
  status: ModelStatus.ERROR,
};

export const mockModel4: Model = {
  ...mockModel,
  name: 'testModel4',
  modelId: 'testModel4',
  status: ModelStatus.IMPORTING,
};

export const mockModelList = [mockModel, mockModel2];

export const mockEvaluationCompleted: Evaluation = {
  modelId: mockModel.modelId,
  evaluationId: 'mockEvaluationCompleted',
  createdAt: new Date('2025-01-01T00:00:00'),
  status: JobStatus.COMPLETED,
  config: {
    evaluationName: 'mockEvaluationCompleted',
    maxLaps: 3,
    maxTimeInMinutes: 10,
    raceType: RaceType.TIME_TRIAL,
    trackConfig: {
      trackId: TrackId.ACE_SPEEDWAY,
      trackDirection: TrackDirection.COUNTER_CLOCKWISE,
    },
    resettingBehaviorConfig: {
      continuousLap: false,
    },
  },
  metrics: [
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 10000,
      crashCount: 0,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      offTrackCount: 1,
      resetCount: 1,
      trial: 1,
    },
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 12000,
      crashCount: 0,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      offTrackCount: 0,
      resetCount: 0,
      trial: 2,
    },
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 11000,
      crashCount: 0,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      offTrackCount: 0,
      resetCount: 0,
      trial: 3,
    },
    {
      completionPercentage: 100,
      elapsedTimeInMilliseconds: 9000,
      crashCount: 0,
      episodeStatus: EpisodeStatus.LAP_COMPLETE,
      offTrackCount: 0,
      resetCount: 0,
      trial: 4,
    },
  ],
  videoUrl: 'https://mock-deepracer-on-aws.com/evaluation/video.mp4',
};

export const mockEvaluationInitializing: Evaluation = {
  ...mockEvaluationCompleted,
  evaluationId: 'mockEvaluationInitializing',
  config: {
    ...mockEvaluationCompleted.config,
    evaluationName: 'mockEvaluationInitializing',
  },
  createdAt: new Date('2025-01-03T00:00:00'),
  status: JobStatus.INITIALIZING,
  videoUrl: undefined,
  videoStreamUrl: undefined,
  metrics: [],
};

export const mockEvaluationInProgress: Evaluation = {
  ...mockEvaluationCompleted,
  evaluationId: 'mockEvaluationInProgress',
  config: {
    ...mockEvaluationCompleted.config,
    evaluationName: 'mockEvaluationInProgress',
  },
  createdAt: new Date('2025-01-05T00:00:00'),
  status: JobStatus.IN_PROGRESS,
  videoUrl: undefined,
  videoStreamUrl: 'https://mock-deepracer-on-aws.com/evaluation/video-stream',
};
