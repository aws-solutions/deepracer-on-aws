// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from '@aws-lambda-powertools/logger';
import { LogAttributes } from '@aws-lambda-powertools/logger/types';

import {
  CombinedLeaderboardRecomputeFailedInput,
  CreateLeaderboardInput,
  CreateSubmissionInput,
  DeepRacerJobInput,
  DownloadModelInput,
  EventLifecycleTransitionInput,
  HeartbeatInput,
  LapsRecordedInput,
  LapValiditySetInput,
  MetricsLogData,
  metricsLogSubscriptionKeyField,
  MetricsSubscriptionKeyValue,
  OptimizeModelInput,
  RaceManagementStatsRebuiltInput,
  UserLoginInput,
} from './metricsTypes.js';

export const metricsLogDataField = 'metricsLogData';

/**
 * Enhanced logger wrapper that provides metric logging functionality
 * Ensures all metric logs contain the required subscription key
 */
export class MetricsLogger {
  constructor(private logger: Logger) {}

  /**
   * Log a metric message that will be picked up by subscription filters
   * Use the specialized public methods below
   * @param message The log message
   * @param data Additional data that MUST include metricsLogSubscriptionKey
   */
  private log(data: MetricsLogData, message?: string): void {
    this.logger.info(message ?? `MetricLog: ${data[metricsLogSubscriptionKeyField]}`, {
      [metricsLogSubscriptionKeyField]: data[metricsLogSubscriptionKeyField],
      [metricsLogDataField]: data as LogAttributes,
    });
  }

  logHeartbeat(data: HeartbeatInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DAILY_HEART_BEAT }, message);
  }

  logImportModel(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.IMPORT_MODEL }, message);
  }

  logDownloadModel(data: DownloadModelInput, message?: string): void {
    this.log(
      {
        ...data,
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DOWNLOAD_MODEL,
      },
      message,
    );
  }

  logCreateEvaluation(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_EVALUATION }, message);
  }

  logCreateLeaderboard(data?: CreateLeaderboardInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_LEADERBOARD }, message);
  }

  logCreateModel(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_MODEL }, message);
  }

  logCreateSubmission(data?: CreateSubmissionInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_SUBMISSION }, message);
  }

  logDeleteModel(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DELETE_MODEL }, message);
  }

  logDeleteProfile(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DELETE_PROFILE }, message);
  }

  logDeleteProfileModels(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DELETE_PROFILE_MODELS }, message);
  }

  logCreateUser(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_USER }, message);
  }

  logDeepRacerJob(data: DeepRacerJobInput, message?: string): void {
    this.log({ ...data, [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.DEEP_RACER_JOB }, message);
  }

  logUserLogin(data: UserLoginInput, message?: string): void {
    this.log({ ...data, [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN }, message);
  }

  logEventLifecycleTransition(data: EventLifecycleTransitionInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.EVENT_LIFECYCLE_TRANSITION }, message);
  }

  logEventsCreated(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.EVENTS_CREATED }, message);
  }

  logLapsRecorded(data?: LapsRecordedInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.LAPS_RECORDED }, message);
  }

  logLapValiditySet(data?: LapValiditySetInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.LAP_VALIDITY_SET }, message);
  }

  logLapEdited(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.LAP_EDITED }, message);
  }

  logImportPhysicalModel(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.IMPORT_PHYSICAL_MODEL }, message);
  }

  logDeployModel(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DEPLOY_MODEL }, message);
  }

  logOptimizeModel(data: OptimizeModelInput, message?: string): void {
    this.log({ ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.OPTIMIZE_MODEL }, message);
  }

  logRunsCompleted(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.RUNS_COMPLETED }, message);
  }

  logCombinedLeaderboardRecomputed(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.COMBINED_LEADERBOARD_RECOMPUTED }, message);
  }

  logCombinedLeaderboardRecomputeFailed(data?: CombinedLeaderboardRecomputeFailedInput, message?: string): void {
    this.log(
      { ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.COMBINED_LEADERBOARD_RECOMPUTE_FAILED },
      message,
    );
  }

  logRaceManagementStatsRebuilt(data: RaceManagementStatsRebuiltInput, message?: string): void {
    this.log(
      { ...data, metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.RACE_MANAGEMENT_STATS_REBUILT },
      message,
    );
  }
}
