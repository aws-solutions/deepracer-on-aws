// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from '@aws-lambda-powertools/logger';
import { LogAttributes } from '@aws-lambda-powertools/logger/types';

import {
  DeepRacerJobInput,
  DownloadModelInput,
  HeartbeatInput,
  MetricsLogData,
  metricsLogSubscriptionKeyField,
  MetricsSubscriptionKeyValue,
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

  logCreateLeaderboard(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_LEADERBOARD }, message);
  }

  logCreateModel(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_MODEL }, message);
  }

  logCreateSubmission(message?: string): void {
    this.log({ metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_SUBMISSION }, message);
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
}
