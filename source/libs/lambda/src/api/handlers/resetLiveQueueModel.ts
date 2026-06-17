// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  getResetLiveQueueModelHandler,
  LiveEventStatus,
  NotFoundError,
  type ResetLiveQueueModelServerInput,
  type ResetLiveQueueModelServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { sageMakerHelper } from '../../workflow/utils/SageMakerHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { lookupInProgressSageMakerJob } from '../utils/lookupInProgressSageMakerJob.js';

export const ResetLiveQueueModelOperation: Operation<
  ResetLiveQueueModelServerInput,
  ResetLiveQueueModelServerOutput,
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

  // Look up the SageMaker job name before the DDB write: the conditional write below
  // changes the item status to PENDING, after which it would no longer match IN_PROGRESS
  // and the lookup would return undefined.
  const sageMakerJobName = leaderboard.currentExecutionArn
    ? await lookupInProgressSageMakerJob({ leaderboardId, submissionId })
    : undefined;

  // DDB write must happen first so the conditional write wins the race against JobMonitor
  let updatedItem;
  try {
    updatedItem = await liveQueueItemDao.resetModel({ leaderboardId, submissionId });
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { name?: string } };
    if (
      err.name === 'ConditionalCheckFailedException' ||
      err.cause?.name === 'ConditionalCheckFailedException' ||
      err.message?.includes('conditional request failed')
    ) {
      throw new ConflictError({ message: 'Item status changed or max resets reached. Please refresh and try again.' });
    }
    throw error;
  }

  if (!updatedItem) {
    throw new NotFoundError({ message: 'Submission not found in queue.' });
  }

  // Stop the SageMaker job only — do NOT stop the SF execution.
  if (sageMakerJobName) {
    try {
      await sageMakerHelper.stopTrainingJob(sageMakerJobName);
    } catch (err) {
      logger.warn('Failed to stop SageMaker job during model reset', { leaderboardId, submissionId, err });
    }
  }

  logger.info('Live queue model reset', {
    leaderboardId,
    submissionId,
    reason: input.reason,
    performedBy: context.profileId,
  });

  return {
    status: updatedItem.status,
    resetCount: updatedItem.resetCount,
    queuePosition: updatedItem.queuePosition,
    autoLaunchEnabled: leaderboard.autoLaunchEnabled ?? false,
  } satisfies ResetLiveQueueModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getResetLiveQueueModelHandler(instrumentOperation(ResetLiveQueueModelOperation)),
);
