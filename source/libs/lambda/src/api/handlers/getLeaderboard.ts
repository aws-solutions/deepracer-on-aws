// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetLeaderboardHandler,
  GetLeaderboardServerInput,
  GetLeaderboardServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toLeaderboardResponse } from '../utils/toLeaderboardResponse.js';

/** This is the implementation of business logic of the GetLeaderboard operation. */
export const GetLeaderboardOperation: Operation<
  GetLeaderboardServerInput,
  GetLeaderboardServerOutput,
  HandlerContext
> = async (input) => {
  const leaderboardId = input.leaderboardId as ResourceId;

  const leaderboardItem = await leaderboardDao.load({ leaderboardId });

  return {
    leaderboard: toLeaderboardResponse(leaderboardItem),
  } satisfies GetLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetLeaderboardHandler(instrumentOperation(GetLeaderboardOperation)),
);
