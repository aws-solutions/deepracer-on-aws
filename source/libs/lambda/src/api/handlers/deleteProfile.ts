// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { ResourceId } from '@deepracer-indy/database';
import {
  getDeleteProfileHandler,
  DeleteProfileServerInput,
  DeleteProfileServerOutput,
  BadRequestError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { deleteUser } from '../../utils/deleteUser.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const DeleteProfileOperation: Operation<
  DeleteProfileServerInput,
  DeleteProfileServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  const targetProfileId = input.profileId as ResourceId;

  const isAdmin = await isUserAdmin(profileId);
  if (!isAdmin) {
    throw new BadRequestError({ message: 'Only administrators can delete user profiles' });
  }

  logger.info('Deleting user profile');
  await deleteUser(targetProfileId);
  logger.info('Deleted user profile');

  metricsLogger.logDeleteProfile();

  return {};
};

export const lambdaHandler = getApiGatewayHandler(getDeleteProfileHandler(instrumentOperation(DeleteProfileOperation)));
