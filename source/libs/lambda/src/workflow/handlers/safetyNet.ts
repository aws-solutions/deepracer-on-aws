// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, liveQueueItemDao, type ResourceId } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

interface SFStatusChangeEvent {
  detail: {
    executionArn: string;
    stateMachineArn: string;
    status: string;
    input: string;
  };
}

const BACKOFF_WINDOW_MS = 60_000;

/**
 * Triggered by EventBridge on SF terminal states (SUCCEEDED/FAILED/ABORTED/TIMED_OUT).
 * Clears the execution lock, applies backoff on repeated failures,
 * and touches a PENDING item to trigger StreamHandler restart if items remain.
 */
const handler = async (event: SFStatusChangeEvent): Promise<void> => {
  const { executionArn, status, input } = event.detail;
  const { leaderboardId } = JSON.parse(input) as { leaderboardId: ResourceId };

  logger.info('SafetyNet invoked', { leaderboardId, executionArn, status });

  // Step 1: Try to clear lock (conditional — only if ARN matches)
  let leaderboard;
  try {
    await leaderboardDao.clearExecutionLock(leaderboardId, executionArn);
  } catch (error) {
    const err = error as { name?: string; message?: string };
    if (err.name !== 'ConditionalCheckFailedException' && !err.message?.includes('conditional request failed')) {
      throw error;
    }
    // Conditional write failed — check if new execution took over
    leaderboard = await leaderboardDao.load({ leaderboardId });
    if (leaderboard.currentExecutionArn) {
      logger.info('New execution already running, exiting', { currentArn: leaderboard.currentExecutionArn });
      return;
    }
    // Lock was already cleared (happy path — ClearExecutionLock inside SF ran first)
    logger.info('Lock already cleared, checking for PENDING items');
  }

  // Step 2: If race is completed, done
  leaderboard ??= await leaderboardDao.load({ leaderboardId });
  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    logger.info('Race is COMPLETED, exiting');
    return;
  }

  // Step 3: Backoff if SF failed twice within 1 minute
  if (status === 'FAILED' || status === 'TIMED_OUT') {
    const now = Date.now();
    if (leaderboard.lastSFFailureAt && now - leaderboard.lastSFFailureAt < BACKOFF_WINDOW_MS) {
      logger.warn('SF failed twice within 1 minute, backing off', { leaderboardId });
      return;
    }
    await leaderboardDao.partialUpdate({ leaderboardId }, { lastSFFailureAt: now });
  }

  // Step 4: If PENDING items exist, touch one to trigger stream → StreamHandler starts SF
  const nextPending = await liveQueueItemDao.getNextPending({ leaderboardId });
  if (nextPending) {
    logger.info('PENDING items found, touching to trigger stream', { submissionId: nextPending.submissionId });
    await liveQueueItemDao.touchItem({ leaderboardId, submissionId: nextPending.submissionId });
  } else {
    logger.info('No PENDING items, nothing to do');
  }
};

export const safetyNet = { handler };
export const lambdaHandler = instrumentHandler(handler);
