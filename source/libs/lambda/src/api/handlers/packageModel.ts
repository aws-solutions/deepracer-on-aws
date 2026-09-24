// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';
import type { Operation } from '@aws-smithy/server-common';
import { modelDao, ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  getPackageModelHandler,
  InternalFailureError,
  ModelSource,
  ModelStatus,
  NotAuthorizedError,
  OptimizationStatus,
  PackageModelServerInput,
  PackageModelServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { lambdaClient } from '#utils/clients/lambdaClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Triggers cloud-side model optimization (OpenVINO IR + TFLite conversion) for a trained model.
 *
 * Validates the model is READY and not already being optimized, then invokes the Model Optimizer
 * Lambda asynchronously. The optimizer runs independently: success sets optimizationStatus to
 * OPTIMIZED; failure sets it to FAILED without affecting the model's READY status.
 *
 * Physical models are rejected since they are optimized during the import workflow.
 */
export const PackageModelOperation: Operation<
  PackageModelServerInput,
  PackageModelServerOutput,
  HandlerContext
> = async (input, context) => {
  const modelId = input.modelId as ResourceId;
  const targetProfileId = input.profileId as ResourceId;
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only Admin or Facilitator users can package models.' });
  }

  const model = await modelDao.load({ modelId, profileId: targetProfileId });

  if (model.status !== ModelStatus.READY) {
    throw new BadRequestError({
      message: `Model must be in READY status to package. Current status: ${model.status}`,
    });
  }

  if (model.optimizationStatus === OptimizationStatus.IN_PROGRESS) {
    throw new BadRequestError({
      message: 'Model optimization is already in progress.',
    });
  }

  if (model.modelSource === ModelSource.IMPORTED_PHYSICAL) {
    throw new BadRequestError({
      message: 'Physical models are already optimized during import.',
    });
  }

  const functionName = process.env.MODEL_OPTIMIZER_FUNCTION_NAME;
  if (!functionName) {
    logger.error('Missing required environment variable', { variable: 'MODEL_OPTIMIZER_FUNCTION_NAME' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  logger.info('Invoking model optimizer', { modelId, targetProfileId });

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: InvocationType.Event,
      Payload: JSON.stringify({ modelId, profileId: targetProfileId }),
    }),
  );

  metricsLogger.logOptimizeModel({ optimizationType: 'virtual' });

  return { modelId } satisfies PackageModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getPackageModelHandler(instrumentOperation(PackageModelOperation)));
