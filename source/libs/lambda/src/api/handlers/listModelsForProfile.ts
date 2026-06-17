// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListModelsForProfileHandler,
  ListModelsForProfileServerInput,
  ListModelsForProfileServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListModelsForProfileOperation: Operation<
  ListModelsForProfileServerInput,
  ListModelsForProfileServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.info('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const targetProfileId = input.profileId as ResourceId;

  const { data: modelItems } = await modelDao.listAll({ profileId: targetProfileId });

  logger.info('Admin list models for profile', {
    action: 'ADMIN_LIST_MODELS',
    adminProfileId: context.profileId,
    targetProfileId,
  });

  return {
    models: modelItems.map((item) => ({
      modelId: item.modelId,
      name: item.name,
      status: item.status,
      createdAt: new Date(item.createdAt),
    })),
  };
};

export const lambdaHandler = getApiGatewayHandler(
  getListModelsForProfileHandler(instrumentOperation(ListModelsForProfileOperation)),
);
