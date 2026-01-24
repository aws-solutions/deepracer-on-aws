// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, ResourceId } from '@deepracer-indy/database';
import {
  getEditLeaderboardHandler,
  EditLeaderboardServerInput,
  EditLeaderboardServerOutput,
  RaceType,
  BadRequestError,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { validateObjectAvoidanceConfig, validateTrackConfig } from '../utils/validation.js';

/** This is the implementation of business logic of the EditLeaderboard operation. */
export const EditLeaderboardOperation: Operation<
  EditLeaderboardServerInput,
  EditLeaderboardServerOutput,
  HandlerContext
> = async (input, _context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const leaderboardDefinition = input.leaderboardDefinition;

  // Check if the leaderboard exists
  const existingLeaderboard = await leaderboardDao.load({ leaderboardId });

  // Check if the leaderboard is in the future (hasn't started yet)
  const currentTime = new Date();
  const openTime = new Date(existingLeaderboard.openTime);
  const closeTime = new Date(existingLeaderboard.closeTime);

  if (openTime <= currentTime) {
    throw new BadRequestError({ message: 'Can only edit future leaderboards that have not started yet.' });
  }

  if (closeTime <= currentTime) {
    throw new BadRequestError({ message: 'Cannot edit closed leaderboards.' });
  }

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
    validateObjectAvoidanceConfig(leaderboardDefinition?.objectAvoidanceConfig);
  }

  validateTrackConfig(leaderboardDefinition.trackConfig);

  // TODO: Only update certain fields if the leaderboard is already open.
  const updatedLeaderboard = await leaderboardDao.update(
    { leaderboardId },
    {
      ...leaderboardDefinition,
      openTime: leaderboardDefinition.openTime.toISOString(),
      closeTime: leaderboardDefinition.closeTime.toISOString(),
      minimumLaps: leaderboardDefinition.submissionTerminationConditions.minimumLaps,
      submissionTerminationConditions: {
        maxLaps: leaderboardDefinition.submissionTerminationConditions.maximumLaps,
        maxTimeInMinutes: leaderboardDefinition.submissionTerminationConditions.maxTimeInMinutes,
      },
    },
  );

  return {
    leaderboard: {
      name: updatedLeaderboard.name,
      openTime: new Date(updatedLeaderboard.openTime),
      closeTime: new Date(updatedLeaderboard.closeTime),
      trackConfig: updatedLeaderboard.trackConfig,
      raceType: updatedLeaderboard.raceType,
      objectAvoidanceConfig: updatedLeaderboard.objectAvoidanceConfig,
      resettingBehaviorConfig: updatedLeaderboard.resettingBehaviorConfig,
      submissionTerminationConditions: {
        maximumLaps: updatedLeaderboard.submissionTerminationConditions.maxLaps,
        minimumLaps: updatedLeaderboard.minimumLaps,
        maxTimeInMinutes: updatedLeaderboard.submissionTerminationConditions.maxTimeInMinutes,
      },
      timingMethod: updatedLeaderboard.timingMethod,
      maxSubmissionsPerUser: updatedLeaderboard.maxSubmissionsPerUser,
      leaderboardId: updatedLeaderboard.leaderboardId,
      participantCount: updatedLeaderboard.participantCount,
    },
  } satisfies EditLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getEditLeaderboardHandler(instrumentOperation(EditLeaderboardOperation)),
);
