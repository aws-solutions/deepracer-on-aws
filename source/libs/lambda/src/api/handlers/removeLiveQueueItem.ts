// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  leaderboardDao,
  liveQueueItemDao,
  modelDao,
  REMOVABLE_LIVE_QUEUE_ITEM_STATUSES,
  type ResourceId,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  getRemoveLiveQueueItemHandler,
  LiveEventStatus,
  ModelStatus,
  type RemoveLiveQueueItemServerInput,
  type RemoveLiveQueueItemServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const RemoveLiveQueueItemOperation: Operation<
  RemoveLiveQueueItemServerInput,
  RemoveLiveQueueItemServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const submissionId = input.submissionId as ResourceId;

  const leaderboard = await leaderboardDao.load({ leaderboardId });

  if (!leaderboard.isLive) {
    throw new BadRequestError({ message: 'Not a live race.' });
  }

  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Cannot modify after race closed.' });
  }

  const item = await liveQueueItemDao.get({ leaderboardId, submissionId });

  if (!item) {
    throw new BadRequestError({ message: 'Invalid submissionId.' });
  }

  if (!REMOVABLE_LIVE_QUEUE_ITEM_STATUSES.includes(item.status)) {
    throw new BadRequestError({ message: 'Cannot remove COMPLETED or IN_PROGRESS items.' });
  }

  try {
    await liveQueueItemDao.remove({ leaderboardId, submissionId });
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { name?: string } };
    if (
      err.name === 'ConditionalCheckFailedException' ||
      err.cause?.name === 'ConditionalCheckFailedException' ||
      err.message?.includes('conditional request failed')
    ) {
      throw new ConflictError({ message: 'Item status changed. Please refresh and try again.' });
    }
    throw error;
  }

  logger.info('Live queue item removed', {
    leaderboardId,
    submissionId,
    performedBy: context.profileId,
  });

  try {
    await modelDao.update({ profileId: item.profileId, modelId: item.modelId }, { status: ModelStatus.READY });
  } catch (err) {
    logger.warn('Failed to restore model status after queue item removal', { leaderboardId, submissionId, err });
  }

  return {} satisfies RemoveLiveQueueItemServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getRemoveLiveQueueItemHandler(instrumentOperation(RemoveLiveQueueItemOperation)),
);
