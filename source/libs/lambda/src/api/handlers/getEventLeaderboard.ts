// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, leaderboardDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import {
  GetEventLeaderboardServerInput,
  GetEventLeaderboardServerOutput,
  getGetEventLeaderboardHandler,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const MAX_RANKINGS = 50;

export const GetEventLeaderboardOperation: Operation<
  GetEventLeaderboardServerInput,
  GetEventLeaderboardServerOutput,
  HandlerContext
> = async (input) => {
  const leaderboardId = input.trackId as ResourceId;

  const leaderboard = await leaderboardDao.get({ leaderboardId });
  if (!leaderboard) {
    throw new NotFoundError({ message: 'Track not found.' });
  }
  if (leaderboard.eventId) {
    await eventDao.load({ eventId: leaderboard.eventId });
  }

  const { data: rankingItems } = await rankingDao.listByRank({
    leaderboardId,
    maxResults: MAX_RANKINGS,
  });

  return {
    rankings: rankingItems.map((item, index) => ({
      rank: index + 1,
      participantName: item.userProfile?.alias ?? '',
      bestLapTimeMilliseconds: item.rankingScore ?? 0,
      modelName: item.modelName ?? '',
    })),
  };
};

export const lambdaHandler = getApiGatewayHandler(
  getGetEventLeaderboardHandler(instrumentOperation(GetEventLeaderboardOperation)),
);
