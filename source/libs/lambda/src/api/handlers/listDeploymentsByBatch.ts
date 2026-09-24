// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deploymentDao, ResourceId } from '@deepracer-indy/database';
import {
  getListDeploymentsByBatchHandler,
  ListDeploymentsByBatchServerInput,
  ListDeploymentsByBatchServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toDeploymentSummary } from '../utils/toDeploymentSummary.js';

/**
 * Lists deployments for a batch push operation.
 * Queries GSI1 (PK=BATCH_{batchId}) sorted by createdAt.
 * Restricted to Admin/Facilitator roles.
 */
export const ListDeploymentsByBatchOperation: Operation<
  ListDeploymentsByBatchServerInput,
  ListDeploymentsByBatchServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only Admin or Facilitator users can view deployments.' });
  }

  const batchId = input.batchId as ResourceId;

  const { cursor, data } = await deploymentDao.listByBatch({
    batchId,
    cursor: input.token,
    maxResults: input.maxResults ?? undefined,
  });

  return {
    batchId,
    deployments: data.map(toDeploymentSummary),
    token: cursor ?? undefined,
  } satisfies ListDeploymentsByBatchServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListDeploymentsByBatchHandler(instrumentOperation(ListDeploymentsByBatchOperation)),
);
