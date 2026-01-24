// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { rankingDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetRankingHandler,
  GetRankingServerInput,
  GetRankingServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const GetRankingOperation: Operation<GetRankingServerInput, GetRankingServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;
  const leaderboardId = input.leaderboardId as ResourceId;

  const rankingItem = await rankingDao.getWithRank({ leaderboardId, profileId });

  if (!rankingItem) {
    return {} satisfies GetRankingServerOutput;
  }

  return {
    ranking: {
      modelId: rankingItem.modelId,
      modelName: rankingItem.modelName,
      rank: rankingItem.rank,
      rankingScore: rankingItem.rankingScore,
      stats: rankingItem.stats,
      submissionNumber: rankingItem.submissionNumber,
      submittedAt: new Date(rankingItem.createdAt),
      videoUrl: await s3Helper.getPresignedUrl(rankingItem.submissionVideoS3Location),
    },
  } satisfies GetRankingServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetRankingHandler(instrumentOperation(GetRankingOperation)));
