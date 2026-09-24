// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * The field name used to identify metric logs for subscription filters
 * This should match the the log subscription filter set up in the cdk code
 */
export const metricsLogSubscriptionKeyField = 'metricsLogSubscriptionKey';

/**
 * Interface that enforces the presence of metricsLogSubscriptionKey with one of the allowed enumerated values
 */
export interface MetricsLogData extends Record<string, unknown> {
  [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue; // Must be one of the enum values
}

/**
 * Enumerated values for metrics subscription keys
 * These values categorize different types of metric logs
 */
export enum MetricsSubscriptionKeyValue {
  DAILY_HEART_BEAT = 'DailyHeartbeat',
  USER_LOG_IN = 'UserLogIn',
  IMPORT_MODEL = 'ImportModel',
  DOWNLOAD_MODEL = 'DownloadModel',
  UNEXPECTED_ERROR = 'UnexpectedError', // not implemented yet
  CREATE_EVALUATION = 'CreateEvaluation',
  CREATE_LEADERBOARD = 'CreateLeaderboard',
  CREATE_MODEL = 'CreateModel',
  CREATE_SUBMISSION = 'CreateSubmission',
  DELETE_MODEL = 'DeleteModel',
  DELETE_PROFILE = 'DeleteProfile',
  DELETE_PROFILE_MODELS = 'DeleteProfileModels',
  CREATE_USER = 'CreateUser',
  DEEP_RACER_JOB = 'DeepRacerJob',
  EVENT_LIFECYCLE_TRANSITION = 'EventLifecycleTransition',
  EVENTS_CREATED = 'EventsCreated',
  LAP_EDITED = 'LapEdited',
  IMPORT_PHYSICAL_MODEL = 'ImportPhysicalModel',
  DEPLOY_MODEL = 'DeployModel',
  OPTIMIZE_MODEL = 'OptimizeModel',
  RUNS_COMPLETED = 'RunsCompleted',
  LAPS_RECORDED = 'LapsRecorded',
  LAP_VALIDITY_SET = 'LapValiditySet',
  COMBINED_LEADERBOARD_RECOMPUTED = 'CombinedLeaderboardRecomputed',
  COMBINED_LEADERBOARD_RECOMPUTE_FAILED = 'CombinedLeaderboardRecomputeFailed',
  RACE_MANAGEMENT_STATS_REBUILT = 'RaceManagementStatsRebuilt',
}

export type HeartbeatInput = {
  models: number;
  users: number;
  races: number;
  trainingJobs: number;
  evaluationJobs: number;
};

export type UserLoginInput = {
  profileId: string;
};

export type DeepRacerJobInput = {
  jobType: string;
  jobStatus: string;
  modelId: string;
  leaderboardId?: string;
  sageMakerMinutes: number;
  isLive?: boolean;
};

export type CreateLeaderboardInput = {
  isLive?: boolean;
};

export type CreateSubmissionInput = {
  isLive?: boolean;
  profileId?: string;
  leaderboardId?: string;
};

export type DownloadModelInput = {
  modelId: string;
};

export type EventLifecycleTransitionInput = {
  from: string;
  to: string;
};

export type LapsRecordedInput = {
  leaderboardId?: string;
  runId?: string;
};

export type LapValiditySetInput = {
  leaderboardId?: string;
  runId?: string;
  isValid?: boolean;
};

export type CombinedLeaderboardRecomputeFailedInput = {
  eventId?: string;
  reason?: string;
};

/**
 * Aggregate deployment-wide counts only — no profileId, no participant names, no
 * per-race identifiers. Reported once per stats rebuild.
 */
export type RaceManagementStatsRebuiltInput = {
  totalEvents: number;
  totalRacers: number;
  totalRaces: number;
  totalLaps: number;
  totalValidLaps: number;
  totalCountries: number;
};

export interface HeartbeatMetricsData extends MetricsLogData, HeartbeatInput {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DAILY_HEART_BEAT;
}

export interface ImportModelMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.IMPORT_MODEL;
}

export interface DownloadModelMetricsData extends MetricsLogData, DownloadModelInput {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DOWNLOAD_MODEL;
}

export interface CreateEvaluationMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_EVALUATION;
}

export interface CreateLeaderboardMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_LEADERBOARD;
}

export interface CreateModelMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_MODEL;
}

export interface CreateSubmissionMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_SUBMISSION;
}

export interface DeleteModelMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DELETE_MODEL;
}

export interface DeleteProfileMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DELETE_PROFILE;
}

export interface DeleteProfileModelsMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DELETE_PROFILE_MODELS;
}

export interface CreateUserMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_USER;
}

export interface DeepRacerJobMetricsData extends MetricsLogData, DeepRacerJobInput {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DEEP_RACER_JOB;
}

export interface UserLoginMetricsData extends MetricsLogData, UserLoginInput {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN;
}

export interface ImportPhysicalModelMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.IMPORT_PHYSICAL_MODEL;
}

export interface DeployModelMetricsData extends MetricsLogData {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DEPLOY_MODEL;
}

export type OptimizeModelInput = {
  optimizationType: string;
};

export interface OptimizeModelMetricsData extends MetricsLogData, OptimizeModelInput {
  metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.OPTIMIZE_MODEL;
}

export type SolutionMetricData = {
  timestamp: string;
  uuid: string;
  solution: string;
  version: string;
  event_name: string;
  context_version: number;
  context: Record<string, unknown> & {
    account: string;
    region: string;
  };
};
