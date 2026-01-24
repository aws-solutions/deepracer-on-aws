// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { metricsDao } from '@deepracer-indy/database';
import { logger, metricsLogger } from '@deepracer-indy/utils';
import type { EventBridgeHandler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * Collects daily heat beat metrics and logs them
 * The invocation event is EventBridge scheduling event witn no detail in the event expected
 */
export const CollectDailyHeartbeat: EventBridgeHandler<'Scheduled Event', Record<string, never>, void> = async () => {
  try {
    const systemMetrics = await metricsDao.collectSystemMetrics();

    metricsLogger.logHeartbeat({
      models: systemMetrics.modelCount,
      users: systemMetrics.profileCount,
      races: systemMetrics.leaderboardCount,
      trainingJobs: systemMetrics.trainingJobCount,
      evaluationJobs: systemMetrics.evaluationJobCount,
    });
  } catch (error) {
    logger.error('Collect daily heart beat  failed', { error });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(CollectDailyHeartbeat);
