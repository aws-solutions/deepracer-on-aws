// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deploymentDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetDeploymentHandler,
  GetDeploymentServerInput,
  GetDeploymentServerOutput,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Returns the full detail record for a single deployment.
 * Restricted to Admin/Facilitator roles (deployment management is facilitator-only).
 */
export const GetDeploymentOperation: Operation<
  GetDeploymentServerInput,
  GetDeploymentServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only Admin or Facilitator users can view deployments.' });
  }

  const modelId = input.modelId as ResourceId;
  const deploymentId = input.deploymentId as ResourceId;

  const deployment = await deploymentDao.get({ modelId, deploymentId });

  if (!deployment) {
    throw new NotFoundError({ message: `Deployment ${deploymentId} not found for model ${modelId}.` });
  }

  return {
    deployment: {
      deploymentId: deployment.deploymentId,
      modelId: deployment.modelId,
      modelName: deployment.modelName,
      carInstanceId: deployment.carInstanceId,
      carName: deployment.carName,
      eventId: deployment.eventId,
      profileId: deployment.profileId,
      batchId: deployment.batchId,
      status: deployment.status,
      errorMessage: deployment.errorMessage,
      createdAt: new Date(deployment.createdAt),
      uploadStartedAt: deployment.uploadStartedAt ? new Date(deployment.uploadStartedAt) : undefined,
      completedAt: deployment.completedAt ? new Date(deployment.completedAt) : undefined,
    },
  } satisfies GetDeploymentServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetDeploymentHandler(instrumentOperation(GetDeploymentOperation)));
