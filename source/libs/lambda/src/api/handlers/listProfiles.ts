// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { profileDao } from '@deepracer-indy/database';
import { DEFAULT_MAX_QUERY_RESULTS } from '@deepracer-indy/database/src/constants/defaults';
import {
  getListProfilesHandler,
  ListProfilesServerInput,
  ListProfilesServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListProfilesOperation: Operation<
  ListProfilesServerInput,
  ListProfilesServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can list all profiles.' });
  }

  const { token } = input;

  const result = await profileDao.list({
    cursor: token,
    maxResults: DEFAULT_MAX_QUERY_RESULTS,
  });

  return {
    profiles: result.data,
    token: result.cursor || undefined,
  };
};

export const lambdaHandler = getApiGatewayHandler(getListProfilesHandler(instrumentOperation(ListProfilesOperation)));
