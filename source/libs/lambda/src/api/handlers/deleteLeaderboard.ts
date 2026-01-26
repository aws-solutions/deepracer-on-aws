// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { leaderboardDao, rankingDao, ResourceId, submissionDao } from '@deepracer-indy/database';
import {
  getDeleteLeaderboardHandler,
  DeleteLeaderboardServerInput,
  DeleteLeaderboardServerOutput,
  BadRequestError,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const DeleteLeaderboardOperation: Operation<
  DeleteLeaderboardServerInput,
  DeleteLeaderboardServerOutput,
  HandlerContext
> = async (input) => {
  const leaderboardId = input.leaderboardId as ResourceId;

  const leaderboardItem = await leaderboardDao.load({ leaderboardId });

  const currentTime = new Date();
  const openTime = new Date(leaderboardItem.openTime);
  const closeTime = new Date(leaderboardItem.closeTime);

  if (currentTime >= openTime && currentTime <= closeTime) {
    throw new BadRequestError({ message: 'Unable to delete an open leaderboard.' });
  }

  if (closeTime <= currentTime) {
    await submissionDao.deleteByLeaderboardId(leaderboardId);
    await rankingDao.deleteByLeaderboardId(leaderboardId);
  }

  await leaderboardDao.delete({ leaderboardId });

  return {} satisfies DeleteLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getDeleteLeaderboardHandler(instrumentOperation(DeleteLeaderboardOperation)),
);
