// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { carLogFetchJobDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListCarLogFetchesHandler,
  ListCarLogFetchesServerInput,
  ListCarLogFetchesServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toCarLogFetchJobResponse } from '../utils/toCarLogResponse.js';

/** `GET /car-logs/fetches` — list fetch jobs, newest first, optionally of one event (Administrators and Race Facilitators). */
export const ListCarLogFetchesOperation: Operation<
  ListCarLogFetchesServerInput,
  ListCarLogFetchesServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can list car log fetches.' });
  }

  const { eventId, token, maxResults } = input;
  const page = eventId
    ? await carLogFetchJobDao.listByEvent({ eventId: eventId as ResourceId, cursor: token, maxResults })
    : await carLogFetchJobDao.list({ cursor: token, maxResults });

  return {
    jobs: page.data.map(toCarLogFetchJobResponse),
    token: page.cursor ?? undefined,
  } satisfies ListCarLogFetchesServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListCarLogFetchesHandler(instrumentOperation(ListCarLogFetchesOperation)),
);
