// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  leaderboardDao,
  liveQueueItemDao,
  modelDao,
  rankingDao,
  submissionDao,
  type ResourceId,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  DeleteLeaderboardServerInput,
  DeleteLeaderboardServerOutput,
  getDeleteLeaderboardHandler,
  LiveEventStatus,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const DeleteLeaderboardOperation: Operation<
  DeleteLeaderboardServerInput,
  DeleteLeaderboardServerOutput,
  HandlerContext
> = async (input) => {
  const leaderboardId = input.leaderboardId as ResourceId;

  const leaderboard = await leaderboardDao.load({ leaderboardId });

  const currentTime = new Date();
  const openTime = new Date(leaderboard.openTime);
  const closeTime = new Date(leaderboard.closeTime);

  if (currentTime >= openTime && currentTime <= closeTime) {
    throw new BadRequestError({ message: 'Unable to delete an open leaderboard.' });
  }

  if (leaderboard.isLive) {
    // SCHEDULED (never launched) → always allow delete
    // IN_PROGRESS with no winner declared → block
    // COMPLETED (winner declared) → allow
    if (leaderboard.liveEventStatus === LiveEventStatus.IN_PROGRESS && !leaderboard.winnerId) {
      throw new BadRequestError({ message: 'Declare a winner first.' });
    }

    // Reset QUEUED models back to READY before deleting queue items
    try {
      const queue = await liveQueueItemDao.getQueue({ leaderboardId });
      const results = await Promise.allSettled(
        queue
          .filter((item) => item.modelId)
          .map((item) =>
            modelDao.update({ profileId: item.profileId, modelId: item.modelId }, { status: ModelStatus.READY }),
          ),
      );
      results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .forEach((r) =>
          logger.warn('Failed to reset model during leaderboard delete', { leaderboardId, reason: r.reason }),
        );
    } catch (err) {
      logger.warn('Failed to fetch queue during leaderboard delete', { leaderboardId, err });
    }

    // Queue items must be deleted before the leaderboard to avoid orphaned records
    await liveQueueItemDao.deleteByLeaderboardId(leaderboardId);
  }

  if (closeTime <= currentTime) {
    await submissionDao.deleteByLeaderboardId(leaderboardId);
    await rankingDao.deleteByLeaderboardId(leaderboardId);
  }

  await leaderboardDao.delete({ leaderboardId });

  return {} satisfies DeleteLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getDeleteLeaderboardHandler(instrumentOperation(DeleteLeaderboardOperation)),
);
