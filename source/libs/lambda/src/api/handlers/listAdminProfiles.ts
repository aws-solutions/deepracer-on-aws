// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { DynamoDBItemAttribute, profileDao } from '@deepracer-indy/database';
import {
  getListAdminProfilesHandler,
  ListAdminProfilesServerInput,
  ListAdminProfilesServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const PROFILE_ATTRIBUTES = [
  DynamoDBItemAttribute.PROFILE_ID,
  DynamoDBItemAttribute.ALIAS,
  DynamoDBItemAttribute.EMAIL_ADDRESS,
  DynamoDBItemAttribute.TOTAL_MODEL_COUNT,
] as const;

export const ListAdminProfilesOperation: Operation<
  ListAdminProfilesServerInput,
  ListAdminProfilesServerOutput,
  HandlerContext
> = async (_input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.info('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const profiles = await profileDao.listProjected(PROFILE_ATTRIBUTES);

  logger.info('Admin profile list', { action: 'ADMIN_PROFILE_LIST', profileId });

  return { profiles };
};

export const lambdaHandler = getApiGatewayHandler(
  getListAdminProfilesHandler(instrumentOperation(ListAdminProfilesOperation)),
);
