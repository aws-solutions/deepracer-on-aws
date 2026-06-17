// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { liveQueueItemDao } from '@deepracer-indy/database';
import { LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { LiveRaceContext } from '../types/liveRaceContext.js';

export interface UpdateQueueStatusInput {
  context: LiveRaceContext;
  status: LiveQueueItemStatus;
  expectedStatus: LiveQueueItemStatus;
}

/**
 * Updates queue item status with conditional check on expected status.
 * Catches conditional failures (item modified externally by reset)
 * and returns context normally.
 */
const handler = async (input: UpdateQueueStatusInput): Promise<LiveRaceContext> => {
  const { context, status, expectedStatus } = input;
  logger.info('START UpdateQueueStatus', { submissionId: context.currentSubmissionId, status, expectedStatus });

  if (!context.currentSubmissionId) {
    throw new Error('currentSubmissionId is required');
  }

  try {
    await liveQueueItemDao.updateStatus({
      leaderboardId: context.leaderboardId,
      submissionId: context.currentSubmissionId,
      status,
      expectedStatus,
    });
    logger.info('Status updated successfully');
  } catch (error) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'ConditionalCheckFailedException' || err.message?.includes('conditional request failed')) {
      logger.warn('Item status changed externally, skipping update', {
        submissionId: context.currentSubmissionId,
        expectedStatus,
        targetStatus: status,
      });
    } else {
      throw error;
    }
  }
  return context;
};

export const updateQueueStatus = { handler };
export const lambdaHandler = instrumentHandler(handler);
