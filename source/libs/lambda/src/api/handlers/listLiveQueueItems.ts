// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { liveQueueItemDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListLiveQueueItemsHandler,
  type ListLiveQueueItemsServerInput,
  type ListLiveQueueItemsServerOutput,
  type LiveQueueItem,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListLiveQueueItemsOperation: Operation<
  ListLiveQueueItemsServerInput,
  ListLiveQueueItemsServerOutput,
  HandlerContext
> = async (input) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const queueItems = await liveQueueItemDao.getQueue({ leaderboardId });

  const items: LiveQueueItem[] = queueItems.map((item) => ({
    leaderboardId: item.leaderboardId,
    submissionId: item.submissionId,
    queuePosition: item.queuePosition,
    profileId: item.profileId,
    modelName: item.modelName,
    modelId: item.modelId,
    participantName: item.participantName,
    status: item.status,
    resetCount: item.resetCount,
    submittedAt: new Date(item.submittedAt),
  }));

  return { items } satisfies ListLiveQueueItemsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListLiveQueueItemsHandler(instrumentOperation(ListLiveQueueItemsOperation)),
);
