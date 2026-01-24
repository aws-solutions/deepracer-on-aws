// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao } from '@deepracer-indy/database';
import {
  getListLeaderboardsHandler,
  Leaderboard,
  ListLeaderboardsServerInput,
  ListLeaderboardsServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListLeaderboardsOperation: Operation<
  ListLeaderboardsServerInput,
  ListLeaderboardsServerOutput,
  HandlerContext
> = async (input, _context) => {
  const { cursor, data: leaderboardItems } = await leaderboardDao.list({ cursor: input.token });

  const leaderboards = leaderboardItems.map(
    (leaderboardItem): Leaderboard => ({
      name: leaderboardItem.name,
      openTime: new Date(leaderboardItem.openTime),
      closeTime: new Date(leaderboardItem.closeTime),
      trackConfig: leaderboardItem.trackConfig,
      raceType: leaderboardItem.raceType,
      objectAvoidanceConfig: leaderboardItem.objectAvoidanceConfig,
      resettingBehaviorConfig: leaderboardItem.resettingBehaviorConfig,
      submissionTerminationConditions: {
        minimumLaps: leaderboardItem.minimumLaps,
        maximumLaps: leaderboardItem.submissionTerminationConditions.maxLaps,
        maxTimeInMinutes: leaderboardItem.submissionTerminationConditions.maxTimeInMinutes,
      },
      timingMethod: leaderboardItem.timingMethod,
      maxSubmissionsPerUser: leaderboardItem.maxSubmissionsPerUser,
      leaderboardId: leaderboardItem.leaderboardId,
      participantCount: leaderboardItem.participantCount,
    }),
  );

  return { leaderboards, token: cursor ?? undefined } satisfies ListLeaderboardsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListLeaderboardsHandler(instrumentOperation(ListLeaderboardsOperation)),
);
