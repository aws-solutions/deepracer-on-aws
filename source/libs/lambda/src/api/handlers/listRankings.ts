// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { rankingDao, leaderboardDao, ResourceId } from '@deepracer-indy/database';
import {
  getListRankingsHandler,
  ListRankingsServerInput,
  ListRankingsServerOutput,
  Ranking,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, waitForAll } from '@deepracer-indy/utils';
import base64url from 'base64url';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

// TODO: Move pagination token ranking context logic into a util
/** This is the implementation of business logic of the ListRankings operation. */
export const ListRankingsOperation: Operation<
  ListRankingsServerInput,
  ListRankingsServerOutput,
  HandlerContext
> = async (input, _context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const token = input.token;

  // Validate leaderboard exists
  await leaderboardDao.load({ leaderboardId });

  let lastEvaluatedKey;
  let itemsSeen = 0;

  // If there's a cursor, decode it to get the LastEvaluatedKey and itemsSeen
  if (token) {
    const decodedCursor = JSON.parse(base64url.decode(token).toString());
    lastEvaluatedKey = decodedCursor.lastEvaluatedKey;
    itemsSeen = decodedCursor.itemsSeen || 0;
  }

  const { cursor, data: rankingItems } = await rankingDao.listByRank({
    leaderboardId,
    cursor: lastEvaluatedKey ? base64url.encode(JSON.stringify(lastEvaluatedKey)) : null,
  });

  const rankings = await waitForAll(
    rankingItems.map(
      async (rankingItem): Promise<Ranking> => ({
        submittedAt: new Date(rankingItem.createdAt),
        stats: rankingItem.stats,
        submissionNumber: rankingItem.submissionNumber,
        userProfile: rankingItem.userProfile,
        rankingScore: rankingItem.rankingScore,
        rank: (itemsSeen += 1), // Calculate rank based on itemsSeen
        videoUrl: await s3Helper.getPresignedUrl(rankingItem.submissionVideoS3Location),
      }),
    ),
  );

  // Encode the updated LastEvaluatedKey (including itemsSeen) as the new cursor
  const encodedCursor = cursor
    ? base64url.encode(
        JSON.stringify({
          lastEvaluatedKey: JSON.parse(base64url.decode(cursor)),
          itemsSeen,
        }),
      )
    : null;

  return {
    rankings,
    token: encodedCursor ?? undefined,
  } satisfies ListRankingsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getListRankingsHandler(instrumentOperation(ListRankingsOperation)));
