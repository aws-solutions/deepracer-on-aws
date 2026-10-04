// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deploymentDao, ResourceId } from '@deepracer-indy/database';
import { DeploymentStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export interface PushDeploymentContext {
  deploymentId: ResourceId;
  modelId: ResourceId;
  carInstanceId: string;
  presignedUrl: string;
  carType: string;
  modelName?: string;
  racerName?: string;
  commandId?: string;
  commandStatus?: string;
  commandError?: string;
  error?: { Cause?: string; Error?: string };
}

export interface UpdateDeploymentStatusInput {
  context: PushDeploymentContext;
  status: DeploymentStatus;
  expectedStatus: DeploymentStatus;
}

/**
 * Updates deployment status with conditional check on expected status.
 * Used by multiple steps in the Push Step Function (PENDING->IN_PROGRESS,
 * IN_PROGRESS->COMPLETED, IN_PROGRESS->FAILED).
 */
const handler = async (input: UpdateDeploymentStatusInput): Promise<PushDeploymentContext> => {
  const { context, status, expectedStatus } = input;
  const { deploymentId, modelId, commandError, error } = context;

  logger.info('Updating deployment status', { deploymentId, modelId, status, expectedStatus });

  const errorMessage =
    status === DeploymentStatus.FAILED
      ? commandError || error?.Cause || error?.Error || 'Deployment failed'
      : undefined;

  await deploymentDao.updateStatus({
    modelId,
    deploymentId,
    status,
    expectedStatus,
    errorMessage,
  });

  return context;
};

export const lambdaHandler = instrumentHandler(handler);
