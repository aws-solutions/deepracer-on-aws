// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, modelDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  getDeclareWinnerHandler,
  LiveEventStatus,
  LiveQueueItemStatus,
  ModelStatus,
  type DeclareWinnerServerInput,
  type DeclareWinnerServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const DeclareWinnerOperation: Operation<
  DeclareWinnerServerInput,
  DeclareWinnerServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const { profileId } = context;
  const leaderboard = await leaderboardDao.load({ leaderboardId });

  if (!leaderboard.isLive) {
    throw new BadRequestError({ message: 'Not a live race.' });
  }

  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    return buildExistingWinnerResponse(leaderboard, leaderboardId);
  }

  if (leaderboard.liveEventStatus !== LiveEventStatus.IN_PROGRESS) {
    throw new BadRequestError({ message: 'Race has not started yet.' });
  }

  if (leaderboard.currentExecutionArn) {
    throw new ConflictError({ message: 'Cannot declare winner while evaluation is running.' });
  }

  // Get rank 1 winner
  const { data: rankings } = await rankingDao.listByRank({ leaderboardId, maxResults: 1 });
  const winner = rankings[0];
  const winnerId = winner?.submissionId ?? undefined;

  // Count pending and failed items
  const queueItems = await liveQueueItemDao.getQueue({ leaderboardId });
  const pendingCount = queueItems.filter((item) => item.status === LiveQueueItemStatus.PENDING).length;
  const failedCount = queueItems.filter((item) => item.status === LiveQueueItemStatus.FAILED).length;

  const winnerDeclaredAt = new Date().toISOString();

  try {
    await leaderboardDao.declareWinner(leaderboardId, { winnerId, winnerDeclaredAt });
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { name?: string } };
    if (
      err.name === 'ConditionalCheckFailedException' ||
      err.cause?.name === 'ConditionalCheckFailedException' ||
      err.message?.includes('conditional request failed')
    ) {
      const updated = await leaderboardDao.load({ leaderboardId });
      if (updated.liveEventStatus === LiveEventStatus.COMPLETED) {
        return buildExistingWinnerResponse(updated, leaderboardId);
      }
      throw new ConflictError({ message: 'Race state changed. Please retry.' });
    }
    throw error;
  }

  logger.info('Winner declared', { leaderboardId, winnerId, performedBy: profileId });

  // Reset all models back to READY now that race is over
  const results = await Promise.allSettled(
    queueItems.map((item) =>
      modelDao.update({ profileId: item.profileId, modelId: item.modelId }, { status: ModelStatus.READY }),
    ),
  );
  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach((r) => logger.warn('Failed to reset model status after winner declaration', { reason: r.reason }));

  return {
    winnerId,
    winnerDeclaredAt: new Date(winnerDeclaredAt),
    liveEventStatus: LiveEventStatus.COMPLETED,
    pendingCount,
    failedCount,
  } satisfies DeclareWinnerServerOutput;
};

async function buildExistingWinnerResponse(
  leaderboard: Awaited<ReturnType<typeof leaderboardDao.load>>,
  leaderboardId: ResourceId,
): Promise<DeclareWinnerServerOutput> {
  const queueItems = await liveQueueItemDao.getQueue({ leaderboardId });
  const pendingCount = queueItems.filter((item) => item.status === LiveQueueItemStatus.PENDING).length;
  const failedCount = queueItems.filter((item) => item.status === LiveQueueItemStatus.FAILED).length;

  return {
    winnerId: leaderboard.winnerId ?? undefined,
    winnerDeclaredAt: leaderboard.winnerDeclaredAt ? new Date(leaderboard.winnerDeclaredAt) : new Date(),
    liveEventStatus: LiveEventStatus.COMPLETED,
    pendingCount,
    failedCount,
  };
}

export const lambdaHandler = getApiGatewayHandler(getDeclareWinnerHandler(instrumentOperation(DeclareWinnerOperation)));
