// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  getGetCombinedLeaderboardHandler,
  GetCombinedLeaderboardServerInput,
  GetCombinedLeaderboardServerOutput,
  Ranking,
} from '@deepracer-indy/typescript-server-client';
import base64url from 'base64url';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Sentinel for `Ranking.videoUrl` on combined-leaderboard entries. The combined leaderboard is a
 * physical-event-only concept — racers race on physical tracks with Timekeeping, not virtual
 * SageMaker evaluations, so there is never a submission video to presign. `videoUrl` is
 * `@required` on the shared `Ranking` shape (used by both virtual and physical leaderboards), so
 * this sentinel avoids a wasted/bogus `s3Helper.getPresignedUrl` call against a physical Ranking's
 * placeholder `submissionVideoS3Location`.
 */
const NO_VIDEO_SENTINEL = '';

/**
 * The combined leaderboard is stored as Ranking items keyed by `leaderboardId = eventId`
 * (see `recomputeCombinedRankingForRacer` in libs/lambda/src/live-race/physical/combinedLeaderboard.ts),
 * so it can be read via the existing RankingDao query surface without any new storage.
 *
 * Paginated per the AWS API Standards Pagination/Unbounded Operations rules — a multi-track
 * event's combined leaderboard has no fixed upper bound on racer count, so this cannot rely on a
 * single unpaginated page (see ListRankings for the identical cursor + itemsSeen pattern, needed
 * because `rank` is derived from result order rather than stored on the item).
 */
export const GetCombinedLeaderboardOperation: Operation<
  GetCombinedLeaderboardServerInput,
  GetCombinedLeaderboardServerOutput,
  HandlerContext
> = async (input) => {
  const eventId = input.eventId as ResourceId;
  const token = input.token;

  const event = await eventDao.load({ eventId });

  if (!event.combinedScoringStrategy) {
    throw new BadRequestError({ message: 'Event has no combined scoring strategy configured.' });
  }

  let lastEvaluatedKey;
  let itemsSeen = 0;

  if (token) {
    const decodedCursor = JSON.parse(base64url.decode(token));
    lastEvaluatedKey = decodedCursor.lastEvaluatedKey;
    itemsSeen = decodedCursor.itemsSeen || 0;
  }

  const { cursor, data: rankingItems } = await rankingDao.listByRank({
    leaderboardId: eventId,
    cursor: lastEvaluatedKey ? base64url.encode(JSON.stringify(lastEvaluatedKey)) : null,
    maxResults: input.maxResults ?? undefined,
  });

  const rankings: Ranking[] = rankingItems.map((rankingItem) => {
    itemsSeen += 1;
    return {
      rank: itemsSeen,
      rankingScore: rankingItem.rankingScore,
      stats: rankingItem.stats,
      submissionNumber: rankingItem.submissionNumber,
      submittedAt: new Date(rankingItem.createdAt),
      userProfile: rankingItem.userProfile,
      videoUrl: NO_VIDEO_SENTINEL,
    };
  });

  const encodedCursor = cursor
    ? base64url.encode(
        JSON.stringify({
          lastEvaluatedKey: JSON.parse(base64url.decode(cursor)),
          itemsSeen,
        }),
      )
    : null;

  return {
    combinedScoringStrategy: event.combinedScoringStrategy,
    rankings,
    token: encodedCursor ?? undefined,
  } satisfies GetCombinedLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetCombinedLeaderboardHandler(instrumentOperation(GetCombinedLeaderboardOperation)),
);
