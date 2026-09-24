// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, type ResourceId } from '@deepracer-indy/database';
import {
  GetEventServerInput,
  GetEventServerOutput,
  getGetEventHandler,
  NotAuthorizedError,
  UserGroups,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserMemberOf } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toEventResponse } from '../utils/toEventResponse.js';

export const GetEventOperation: Operation<GetEventServerInput, GetEventServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (
    !(await isUserMemberOf(context.profileId, [
      UserGroups.ADMIN,
      UserGroups.RACE_FACILITATORS,
      UserGroups.COMMENTATORS,
      UserGroups.RACERS,
    ]))
  ) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const eventId = input.eventId as ResourceId;
  const eventItem = await eventDao.load({ eventId });
  return { event: toEventResponse(eventItem) } satisfies GetEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetEventHandler(instrumentOperation(GetEventOperation)));
