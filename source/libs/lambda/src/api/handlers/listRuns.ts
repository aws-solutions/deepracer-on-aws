// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { runDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListRunsHandler,
  ListRunsServerInput,
  ListRunsServerOutput,
  NotAuthorizedError,
  UserGroups,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserMemberOf } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toRunResponse } from '../utils/toRunResponse.js';

/** This is the implementation of business logic of the ListRuns operation. */
export const ListRunsOperation: Operation<ListRunsServerInput, ListRunsServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserMemberOf(context.profileId, [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.RACERS]))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const leaderboardId = input.leaderboardId as ResourceId;
  const eventId = input.eventId as ResourceId;

  const { cursor, data: runItems } = await runDao.list({
    leaderboardId,
    cursor: input.token,
    status: input.status,
    eventId,
  });

  return {
    runs: runItems.map(toRunResponse),
    token: cursor ?? undefined,
  } satisfies ListRunsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getListRunsHandler(instrumentOperation(ListRunsOperation)));
