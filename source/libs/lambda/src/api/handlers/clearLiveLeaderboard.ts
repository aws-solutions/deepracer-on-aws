// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StopExecutionCommand } from '@aws-sdk/client-sfn';
import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  getClearLiveLeaderboardHandler,
  LiveEventStatus,
  type ClearLiveLeaderboardServerInput,
  type ClearLiveLeaderboardServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import { sageMakerHelper } from '../../workflow/utils/SageMakerHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { lookupInProgressSageMakerJob } from '../utils/lookupInProgressSageMakerJob.js';

export const ClearLiveLeaderboardOperation: Operation<
  ClearLiveLeaderboardServerInput,
  ClearLiveLeaderboardServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;

  const leaderboard = await leaderboardDao.load({ leaderboardId });

  if (!leaderboard.isLive) {
    throw new BadRequestError({ message: 'Not a live race.' });
  }

  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Cannot modify after race closed.' });
  }

  if (leaderboard.currentExecutionArn) {
    const sageMakerJobName = await lookupInProgressSageMakerJob({ leaderboardId });

    try {
      await sfnClient.send(new StopExecutionCommand({ executionArn: leaderboard.currentExecutionArn }));
    } catch (err) {
      logger.warn('Failed to stop step function execution', {
        leaderboardId,
        executionArn: leaderboard.currentExecutionArn,
        err,
      });
    }

    if (sageMakerJobName) {
      try {
        await sageMakerHelper.stopTrainingJob(sageMakerJobName);
      } catch (err) {
        logger.warn('Failed to stop SageMaker job during leaderboard clear', { leaderboardId, err });
      }
    }
  }

  const { itemsReset, itemsFailed } = await liveQueueItemDao.resetAll({ leaderboardId });
  try {
    await rankingDao.deleteByLeaderboardId(leaderboardId);
  } catch (err) {
    logger.warn('Failed to delete rankings during leaderboard clear', { leaderboardId, err });
  }

  if (itemsFailed > 0) {
    logger.warn('Live leaderboard clear had failures', {
      leaderboardId,
      itemsReset,
      itemsFailed,
      performedBy: context.profileId,
    });
  } else {
    logger.info('Live leaderboard cleared', { leaderboardId, itemsReset, performedBy: context.profileId });
  }

  return { itemsReset, itemsFailed } satisfies ClearLiveLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getClearLiveLeaderboardHandler(instrumentOperation(ClearLiveLeaderboardOperation)),
);
