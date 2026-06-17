// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao } from '@deepracer-indy/database';
import {
  getCreateLeaderboardHandler,
  CreateLeaderboardServerInput,
  CreateLeaderboardServerOutput,
  LiveEventStatus,
  RaceType,
  BadRequestError,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { validateObjectAvoidanceConfig, validateTrackConfig } from '../utils/validation.js';

/** This is the implementation of business logic of the CreateLeaderboard operation. */
export const CreateLeaderboardOperation: Operation<
  CreateLeaderboardServerInput,
  CreateLeaderboardServerOutput,
  HandlerContext
> = async (input) => {
  const { leaderboardDefinition } = input;

  validateTrackConfig(leaderboardDefinition.trackConfig);

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

  if (leaderboardDefinition.isLive) {
    if (!leaderboardDefinition.liveEventTime) {
      throw new BadRequestError({ message: 'liveEventTime is required for live races.' });
    }
    if (leaderboardDefinition.liveEventTime <= new Date()) {
      throw new BadRequestError({ message: 'Event time must be in the future.' });
    }
  }

  const leaderboardItem = await leaderboardDao.create({
    name: leaderboardDefinition.name,
    resettingBehaviorConfig: leaderboardDefinition.resettingBehaviorConfig,
    raceType: leaderboardDefinition.raceType,
    trackConfig: leaderboardDefinition.trackConfig,
    maxSubmissionsPerUser: leaderboardDefinition.maxSubmissionsPerUser,
    submissionTerminationConditions: {
      maxLaps: leaderboardDefinition.submissionTerminationConditions.maximumLaps,
      maxTimeInMinutes: leaderboardDefinition.submissionTerminationConditions.maxTimeInMinutes,
    },
    minimumLaps: leaderboardDefinition.submissionTerminationConditions.minimumLaps,
    timingMethod: leaderboardDefinition.timingMethod,
    objectAvoidanceConfig: leaderboardDefinition.objectAvoidanceConfig,
    closeTime: leaderboardDefinition.closeTime.toISOString(),
    openTime: leaderboardDefinition.openTime.toISOString(),
    ...(leaderboardDefinition.isLive && {
      isLive: true,
      liveEventTime: leaderboardDefinition.liveEventTime?.toISOString(),
      liveEventStatus: LiveEventStatus.SCHEDULED,
      submissionPeriodOpen: false,
      maxResets: leaderboardDefinition.maxResets ?? 3,
    }),
  });

  metricsLogger.logCreateLeaderboard({ isLive: leaderboardDefinition.isLive ?? false });

  return {
    leaderboardId: leaderboardItem.leaderboardId,
  } satisfies CreateLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getCreateLeaderboardHandler(instrumentOperation(CreateLeaderboardOperation)),
);
