// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  getLaunchLiveRaceHandler,
  LiveEventStatus,
  type LaunchLiveRaceServerInput,
  type LaunchLiveRaceServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const LaunchLiveRaceOperation: Operation<
  LaunchLiveRaceServerInput,
  LaunchLiveRaceServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const { profileId } = context;
  const leaderboard = await leaderboardDao.load({ leaderboardId });

  if (!leaderboard.isLive) {
    throw new BadRequestError({ message: 'Not a live race.' });
  }

  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Race already completed.' });
  }

  if (leaderboard.currentExecutionArn) {
    throw new ConflictError({ message: 'Evaluation already in progress.' });
  }

  if (leaderboard.liveEventStatus === LiveEventStatus.SCHEDULED) {
    if (leaderboard.submissionPeriodOpen) {
      throw new BadRequestError({ message: 'Must close submissions before starting.' });
    }
    if (leaderboard.liveEventTime && new Date() < new Date(leaderboard.liveEventTime)) {
      throw new BadRequestError({ message: 'Cannot start before scheduled time.' });
    }
  }

  const nextPending = await liveQueueItemDao.getNextPending({ leaderboardId });
  if (!nextPending) {
    throw new BadRequestError({ message: 'No pending items in queue.' });
  }

  // Acquire execution lock atomically via conditional write.
  // If another request acquired the lock between our check and this write, this throws.
  const stateMachineArn = process.env.LIVE_RACE_STATE_MACHINE_ARN;
  const executionName = `live-race-${leaderboardId}-${Date.now()}`;
  const placeholderArn = `pending:${executionName}`;

  try {
    await leaderboardDao.acquireExecutionLock(leaderboardId, placeholderArn);
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { name?: string } };
    if (
      err.name === 'ConditionalCheckFailedException' ||
      err.cause?.name === 'ConditionalCheckFailedException' ||
      err.message?.includes('conditional request failed')
    ) {
      throw new ConflictError({ message: 'Evaluation already in progress.' });
    }
    throw error;
  }

  // Lock acquired — now start the Step Functions execution.
  let executionArn: string;
  try {
    const response = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify({ leaderboardId, modelsProcessed: 0 }),
      }),
    );
    executionArn = response.executionArn ?? ''; // TODO remove this condition check as the step function always returns this.
  } catch (error) {
    logger.error('Failed to start execution, releasing lock', { leaderboardId, error });
    try {
      await leaderboardDao.clearExecutionLock(leaderboardId, placeholderArn);
    } catch (cleanupError) {
      logger.error('Failed to release lock after start failure', { leaderboardId, cleanupError });
    }
    throw error;
  }

  // Update the placeholder ARN with the real one
  await leaderboardDao.partialUpdate({ leaderboardId }, { currentExecutionArn: executionArn });

  logger.info('Started live race execution', { executionArn, leaderboardId, performedBy: profileId });

  return {
    executionArn,
    liveEventStatus: LiveEventStatus.IN_PROGRESS,
  } satisfies LaunchLiveRaceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getLaunchLiveRaceHandler(instrumentOperation(LaunchLiveRaceOperation)),
);
