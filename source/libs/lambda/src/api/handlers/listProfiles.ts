// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { profileDao } from '@deepracer-indy/database';
import { DEFAULT_MAX_QUERY_RESULTS } from '@deepracer-indy/database/src/constants/defaults';
import {
  getListProfilesHandler,
  ListProfilesServerInput,
  ListProfilesServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListProfilesOperation: Operation<
  ListProfilesServerInput,
  ListProfilesServerOutput,
  HandlerContext
> = async (input, _context) => {
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
