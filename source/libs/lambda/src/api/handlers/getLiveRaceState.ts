// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, liveQueueItemDao, rankingDao, submissionDao, ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  getGetLiveRaceStateHandler,
  GetLiveRaceStateServerInput,
  GetLiveRaceStateServerOutput,
  LiveEventStatus,
  LiveQueueItemStatus,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const GetLiveRaceStateOperation: Operation<
  GetLiveRaceStateServerInput,
  GetLiveRaceStateServerOutput,
  HandlerContext
> = async (input) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const leaderboard = await leaderboardDao.load({ leaderboardId });

  if (!leaderboard.isLive) {
    throw new BadRequestError({ message: 'Not a live race.' });
  }

  const [queue, { data: rankings }] = await Promise.all([
    liveQueueItemDao.getQueue({ leaderboardId }),
    rankingDao.listByRank({ leaderboardId }),
  ]);

  const currentItem = queue.find((queueItem) => queueItem.status === LiveQueueItemStatus.IN_PROGRESS);

  let streamUrl: string | undefined;
  if (currentItem) {
    try {
      const submission = await submissionDao.get({
        profileId: currentItem.profileId,
        leaderboardId,
        submissionId: currentItem.submissionId as ResourceId,
      });
      streamUrl = submission?.videoStreamUrl;
    } catch {
      /** no-op — streamUrl remains undefined */
    }
  }

  return {
    race: {
      leaderboardId: leaderboard.leaderboardId,
      name: leaderboard.name,
      liveEventStatus: leaderboard.liveEventStatus ?? LiveEventStatus.SCHEDULED,
      isLive: true,
      autoLaunchEnabled: leaderboard.autoLaunchEnabled ?? false,
      submissionPeriodOpen: leaderboard.submissionPeriodOpen ?? false,
    },
    currentEvaluation: currentItem
      ? {
          submissionId: currentItem.submissionId,
          participantName: currentItem.participantName,
          modelName: currentItem.modelName,
          status: currentItem.status,
          streamUrl,
        }
      : undefined,
    queue: {
      totalModels: queue.length,
      completedModels: queue.filter((queueItem) => queueItem.status === LiveQueueItemStatus.COMPLETED).length,
      pendingModels: queue.filter((queueItem) => queueItem.status === LiveQueueItemStatus.PENDING).length,
      inProgressModels: currentItem ? 1 : 0,
    },
    rankings: rankings.map((rankingItem, index) => ({
      rank: index + 1,
      participantName: rankingItem.userProfile.alias,
      modelName: rankingItem.modelName,
      bestLapTime: rankingItem.rankingScore,
      avatar: rankingItem.userProfile.avatar,
    })),
    winner: leaderboard.winnerId
      ? {
          submissionId: leaderboard.winnerId,
          winnerDeclaredAt: new Date(leaderboard.winnerDeclaredAt ?? ''),
        }
      : undefined,
  } satisfies GetLiveRaceStateServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetLiveRaceStateHandler(instrumentOperation(GetLiveRaceStateOperation)),
);
