// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { lapDao, runDao, type ResourceId } from '@deepracer-indy/database';
import {
  GetRunServerInput,
  GetRunServerOutput,
  getGetRunHandler,
  NotAuthorizedError,
  UserGroups,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserMemberOf } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toLapResponse } from '../utils/toLapResponse.js';
import { toRunResponse } from '../utils/toRunResponse.js';

/** This is the implementation of business logic of the GetRun operation. */
export const GetRunOperation: Operation<GetRunServerInput, GetRunServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserMemberOf(context.profileId, [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.RACERS]))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const leaderboardId = input.leaderboardId as ResourceId;
  const eventId = input.eventId as ResourceId;
  const runId = input.runId as ResourceId;

  const [runItem, { data: lapItems }] = await Promise.all([
    runDao.load({ leaderboardId, runId }),
    lapDao.listAllLapsByRun({ leaderboardId, runId }),
  ]);

  if (runItem.eventId !== eventId) {
    throw new NotFoundError({ message: 'Run not found on this event.' });
  }

  return {
    run: toRunResponse(runItem),
    laps: lapItems.map(toLapResponse),
  } satisfies GetRunServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetRunHandler(instrumentOperation(GetRunOperation)));
