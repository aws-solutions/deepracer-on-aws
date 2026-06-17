// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, ResourceId } from '@deepracer-indy/database';
import {
  getEditLeaderboardHandler,
  EditLeaderboardServerInput,
  EditLeaderboardServerOutput,
  LiveEventStatus,
  RaceType,
  BadRequestError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toLeaderboardResponse } from '../utils/toLeaderboardResponse.js';
import { validateObjectAvoidanceConfig, validateTrackConfig } from '../utils/validation.js';

type LeaderboardItem = Awaited<ReturnType<typeof leaderboardDao.load>>;

/**
 * Builds the partial update payload for live-race toggle fields.
 * Returns `null` when no live-toggle fields are present on the input.
 */
const buildLiveUpdates = (
  input: EditLeaderboardServerInput,
  existingLeaderboard: LeaderboardItem,
): Record<string, unknown> | null => {
  const updates: Record<string, unknown> = {};

  if (existingLeaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Cannot modify a completed live race.' });
  }

  if (input.autoLaunchEnabled !== undefined) {
    updates.autoLaunchEnabled = input.autoLaunchEnabled;
  }

  if (input.submissionPeriodOpen !== undefined) {
    updates.submissionPeriodOpen = input.submissionPeriodOpen;
  }

  if (input.liveEventTime !== undefined) {
    if (new Date(input.liveEventTime) <= new Date()) {
      throw new BadRequestError({ message: 'Event time must be in the future.' });
    }
    updates.liveEventTime = input.liveEventTime.toISOString();
  }

  return Object.keys(updates).length > 0 ? updates : null;
};

/**
 * If autolaunch toggled ON with no SF running, touch a PENDING item to trigger stream.
 * Best-effort — stream handler will pick up pending items on its own.
 */
const triggerAutolaunchIfNeeded = async (
  input: EditLeaderboardServerInput,
  existingLeaderboard: LeaderboardItem,
  leaderboardId: ResourceId,
): Promise<void> => {
  const shouldTrigger = input.autoLaunchEnabled === true && !existingLeaderboard.currentExecutionArn;
  if (!shouldTrigger) return;

  try {
    const nextPending = await liveQueueItemDao.getNextPending({ leaderboardId });
    if (nextPending) {
      await liveQueueItemDao.touchItem({ leaderboardId, submissionId: nextPending.submissionId });
    }
  } catch (err) {
    logger.warn('Failed to touch pending queue item after autolaunch toggle', { leaderboardId, err });
  }
};

/** Guards that the leaderboard is in an editable state for a full definition edit. */
const assertLeaderboardEditable = (existingLeaderboard: LeaderboardItem): void => {
  if (existingLeaderboard.isLive) {
    if (existingLeaderboard.liveEventStatus !== LiveEventStatus.SCHEDULED) {
      throw new BadRequestError({ message: 'Can only edit live races before they start.' });
    }
    return;
  }

  const currentTime = new Date();
  const openTime = new Date(existingLeaderboard.openTime);
  const closeTime = new Date(existingLeaderboard.closeTime);

  if (openTime <= currentTime) {
    throw new BadRequestError({ message: 'Can only edit future leaderboards that have not started yet.' });
  }

  if (closeTime <= currentTime) {
    throw new BadRequestError({ message: 'Cannot edit closed leaderboards.' });
  }
};

/** Validates the incoming leaderboard definition payload. */
const validateLeaderboardDefinition = (
  leaderboardDefinition: NonNullable<EditLeaderboardServerInput['leaderboardDefinition']>,
): void => {
  if (leaderboardDefinition.openTime >= leaderboardDefinition.closeTime) {
    throw new BadRequestError({ message: 'Opening time cannot be after close time.' });
  }

  if (
    leaderboardDefinition.submissionTerminationConditions.maximumLaps <
    leaderboardDefinition.submissionTerminationConditions.minimumLaps
  ) {
    throw new BadRequestError({ message: 'Invalid maximum and minimum laps.' });
  }

  if (leaderboardDefinition.raceType === RaceType.OBJECT_AVOIDANCE) {
    validateObjectAvoidanceConfig(leaderboardDefinition.objectAvoidanceConfig);
  }

  validateTrackConfig(leaderboardDefinition.trackConfig);
};

/** Business logic for the EditLeaderboard operation. */
export const EditLeaderboardOperation: Operation<
  EditLeaderboardServerInput,
  EditLeaderboardServerOutput,
  HandlerContext
> = async (input, _context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const existingLeaderboard = await leaderboardDao.load({ leaderboardId });

  // Path 1: Live race toggle updates (partial update, no full definition required).
  if (existingLeaderboard.isLive) {
    const liveUpdates = buildLiveUpdates(input, existingLeaderboard);
    if (liveUpdates) {
      if (input.leaderboardDefinition) {
        throw new BadRequestError({ message: 'Cannot combine toggle fields with leaderboardDefinition.' });
      }
      const updatedLeaderboard = await leaderboardDao.partialUpdate({ leaderboardId }, liveUpdates);
      await triggerAutolaunchIfNeeded(input, existingLeaderboard, leaderboardId);
      return { leaderboard: toLeaderboardResponse(updatedLeaderboard) } satisfies EditLeaderboardServerOutput;
    }
  }

  // Path 2: Full definition edit (community or scheduled live race).
  const { leaderboardDefinition } = input;
  if (!leaderboardDefinition) {
    throw new BadRequestError({ message: 'leaderboardDefinition is required.' });
  }

  assertLeaderboardEditable(existingLeaderboard);
  validateLeaderboardDefinition(leaderboardDefinition);

  // TODO: Only update certain fields if the leaderboard is already open.
  const updatedLeaderboard = await leaderboardDao.update(
    { leaderboardId },
    {
      ...leaderboardDefinition,
      openTime: leaderboardDefinition.openTime.toISOString(),
      closeTime: leaderboardDefinition.closeTime.toISOString(),
      liveEventTime: leaderboardDefinition.liveEventTime?.toISOString(),
      minimumLaps: leaderboardDefinition.submissionTerminationConditions.minimumLaps,
      submissionTerminationConditions: {
        maxLaps: leaderboardDefinition.submissionTerminationConditions.maximumLaps,
        maxTimeInMinutes: leaderboardDefinition.submissionTerminationConditions.maxTimeInMinutes,
      },
    },
  );

  return { leaderboard: toLeaderboardResponse(updatedLeaderboard) } satisfies EditLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getEditLeaderboardHandler(instrumentOperation(EditLeaderboardOperation)),
);
