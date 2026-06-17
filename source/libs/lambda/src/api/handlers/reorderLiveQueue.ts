// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  getReorderLiveQueueHandler,
  LiveEventStatus,
  LiveQueueItemStatus,
  type ReorderLiveQueueServerInput,
  type ReorderLiveQueueServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ReorderLiveQueueOperation: Operation<
  ReorderLiveQueueServerInput,
  ReorderLiveQueueServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const submissionId = input.submissionId as ResourceId;
  const afterSubmissionId = (input.afterSubmissionId as ResourceId) ?? null;

  if (submissionId === afterSubmissionId) {
    throw new BadRequestError({ message: 'Cannot reorder item after itself.' });
  }

  const leaderboard = await leaderboardDao.load({ leaderboardId });

  if (!leaderboard.isLive) {
    throw new BadRequestError({ message: 'Not a live race.' });
  }

  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Cannot modify after race closed.' });
  }

  const queue = await liveQueueItemDao.getQueue({ leaderboardId });
  const item = queue.find((i) => i.submissionId === submissionId);
  if (!item) {
    throw new BadRequestError({ message: 'Invalid submissionId.' });
  }
  if (item.status !== LiveQueueItemStatus.PENDING) {
    throw new BadRequestError({ message: 'Can only reorder pending items.' });
  }

  if (afterSubmissionId != null && !queue.some((i) => i.submissionId === afterSubmissionId)) {
    throw new BadRequestError({ message: 'Invalid afterSubmissionId.' });
  }

  const updated = await liveQueueItemDao.reorder({ leaderboardId, submissionId, afterSubmissionId, queue });

  logger.info('Live queue item reordered', {
    leaderboardId,
    submissionId,
    afterSubmissionId,
    performedBy: context.profileId,
  });

  return {
    item: {
      leaderboardId: updated.leaderboardId,
      submissionId: updated.submissionId,
      queuePosition: updated.queuePosition,
      profileId: updated.profileId,
      modelName: updated.modelName,
      participantName: updated.participantName,
      status: updated.status,
      resetCount: updated.resetCount,
      submittedAt: new Date(updated.submittedAt),
    },
  } satisfies ReorderLiveQueueServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getReorderLiveQueueHandler(instrumentOperation(ReorderLiveQueueOperation)),
);
