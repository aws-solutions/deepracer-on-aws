// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_MAX_QUERY_RESULTS } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';
import type { EventBridgeHandler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { usageQuotaHelper } from '../../utils/UsageQuotaHelper.js';

/**
 * Monthly quota reset function that runs on the 1st of every month
 * Resets usage quotas for all users
 * The invocation event is EventBridge scheduling event witn no detail in the event expected
 */
export const ResetMonthlyQuotas: EventBridgeHandler<'Scheduled Event', Record<string, never>, void> = async (event) => {
  logger.info('Monthly quota reset lambda started', { input: event });
  try {
    const currentMonth = new Date().getMonth() + 1;
    logger.info('Starting monthly quota reset', { month: currentMonth });

    await usageQuotaHelper.resetMonthlyQuotas(
      Number(process.env.PROFILE_UPDATE_BATCH_SIZE ?? DEFAULT_MAX_QUERY_RESULTS),
    );

    logger.info('Monthly quota reset completed successfully', {
      month: currentMonth,
    });
  } catch (error) {
    logger.error('Monthly quota reset failed', { error });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(ResetMonthlyQuotas);
