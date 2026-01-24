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
};

export type DownloadModelInput = {
  modelId: string;
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
