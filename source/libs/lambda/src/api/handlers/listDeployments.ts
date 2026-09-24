// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deploymentDao, ResourceId } from '@deepracer-indy/database';
import {
  getListDeploymentsHandler,
  ListDeploymentsServerInput,
  ListDeploymentsServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toDeploymentSummary } from '../utils/toDeploymentSummary.js';

/**
 * Lists deployments for a given model (paginated).
 * Ordered by deploymentId (random UUID, not chronological). For time-ordered
 * results use ListDeploymentsByBatch or ListDeploymentsByEvent which sort by createdAt.
 * Restricted to Admin/Facilitator roles.
 */
export const ListDeploymentsOperation: Operation<
  ListDeploymentsServerInput,
  ListDeploymentsServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only Admin or Facilitator users can view deployments.' });
  }

  const modelId = input.modelId as ResourceId;

  const { cursor, data } = await deploymentDao.listByModel({
    modelId,
    cursor: input.token,
    maxResults: input.maxResults ?? undefined,
  });

  return {
    deployments: data.map(toDeploymentSummary),
    token: cursor ?? undefined,
  } satisfies ListDeploymentsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListDeploymentsHandler(instrumentOperation(ListDeploymentsOperation)),
);
