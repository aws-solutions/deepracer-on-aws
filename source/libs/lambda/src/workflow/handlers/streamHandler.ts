// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import { leaderboardDao, type ResourceId } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { DynamoDBStreamEvent } from 'aws-lambda';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * DynamoDB stream trigger. When a live queue item changes, checks if the leaderboard
 * is live, in progress, autolaunch enabled, and no SF running — then starts a new execution.
 */
const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  logger.info('StreamHandler invoked', { recordCount: event.Records.length });

  // Deduplicate by leaderboardId — only need to check once per leaderboard per batch
  const leaderboardIds = new Set<string>();
  for (const record of event.Records) {
    const pk = record.dynamodb?.Keys?.pk?.S;
    if (!pk?.includes('#livequeueitem')) continue;
    const leaderboardId = pk.split('#')[0];
    leaderboardIds.add(leaderboardId.replace('leaderboard_', ''));
  }

  for (const leaderboardId of leaderboardIds) {
    try {
      await processLeaderboard(leaderboardId as ResourceId);
    } catch (error) {
      logger.error('Failed to process leaderboard', { leaderboardId, error });
    }
  }
};

async function processLeaderboard(leaderboardId: ResourceId): Promise<void> {
  const leaderboard = await leaderboardDao.load({ leaderboardId });

  // All preconditions must be true
  if (!leaderboard.isLive) return;
  if (leaderboard.liveEventStatus !== LiveEventStatus.IN_PROGRESS) return;
  if (!leaderboard.autoLaunchEnabled) return;
  if (leaderboard.currentExecutionArn) return;

  // Acquire lock
  const executionName = `live-race-${leaderboardId}-${Date.now()}`;
  const placeholderArn = `pending:${executionName}`;

  try {
    await leaderboardDao.acquireExecutionLock(leaderboardId, placeholderArn);
  } catch {
    logger.info('Lock already held, skipping', { leaderboardId });
    return;
  }

  // Start SF
  let executionArn: string;
  try {
    const result = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.LIVE_RACE_STATE_MACHINE_ARN,
        name: executionName,
        input: JSON.stringify({ leaderboardId, modelsProcessed: 0 }),
      }),
    );
    if (!result.executionArn) {
      throw new Error('StartExecution returned no executionArn');
    }
    executionArn = result.executionArn;
  } catch (error) {
    logger.error('Failed to start SF, clearing lock', { leaderboardId, error });
    try {
      await leaderboardDao.clearExecutionLock(leaderboardId, placeholderArn);
    } catch (cleanupError) {
      logger.error('Failed to clear lock after SF start failure', { leaderboardId, cleanupError });
    }
    return;
  }

  // SF started — update placeholder with real ARN. Failure is non-fatal (placeholder still holds lock).
  try {
    await leaderboardDao.partialUpdate({ leaderboardId }, { currentExecutionArn: executionArn });
  } catch (err) {
    logger.warn('Failed to update ARN after SF start, placeholder still holds lock', { leaderboardId, err });
  }

  logger.info('SF started by StreamHandler', { leaderboardId, executionArn });
}

export const streamHandler = { handler };
export const lambdaHandler = instrumentHandler(handler);
