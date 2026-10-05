// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { carLogFetchJobDao, type ResourceId } from '@deepracer-indy/database';
import {
  getGetCarLogFetchHandler,
  GetCarLogFetchServerInput,
  GetCarLogFetchServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toCarLogFetchJobResponse } from '../utils/toCarLogResponse.js';

/** `GET /car-logs/fetches/{jobId}` — one fetch job (Administrators and Race Facilitators). */
export const GetCarLogFetchOperation: Operation<
  GetCarLogFetchServerInput,
  GetCarLogFetchServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can view car log fetches.' });
  }

  const job = await carLogFetchJobDao.load({ jobId: input.jobId as ResourceId });
  return { job: toCarLogFetchJobResponse(job) } satisfies GetCarLogFetchServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetCarLogFetchHandler(instrumentOperation(GetCarLogFetchOperation)),
);
