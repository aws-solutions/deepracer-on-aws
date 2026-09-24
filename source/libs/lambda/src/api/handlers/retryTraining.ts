// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, ResourceId, trainingDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  getRetryTrainingHandler,
  JobStatus,
  ModelStatus,
  RetryTrainingServerInput,
  RetryTrainingServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, waitForAll } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { trainingDispatchHelper } from '../utils/TrainingDispatchHelper.js';

/** Model statuses that are permanently past retrying — a retry request for one is a bad request. */
const TERMINAL_MODEL_STATUSES: ModelStatus[] = [ModelStatus.READY, ModelStatus.ERROR, ModelStatus.DELETING];

/**
 * Retries dispatching the training job for a model that is WAITING_FOR_CAPACITY.
 *
 * Both SageMaker quotas are rechecked. On available capacity the records move to QUEUED and exactly
 * one workflow message is sent; otherwise they stay WAITING_FOR_CAPACITY and nothing is queued. The
 * operation is idempotent — the conditional status transition inside the dispatch helper means
 * concurrent requests cannot produce duplicate messages.
 */
export const RetryTrainingOperation: Operation<
  RetryTrainingServerInput,
  RetryTrainingServerOutput,
  HandlerContext
> = async (input, context) => {
  const modelId = input.modelId as ResourceId;
  const { profileId } = context;

  // `load` throws NotFoundError, and the profileId comes from the caller's token, so a model owned by
  // someone else is indistinguishable from one that does not exist.
  const [modelItem, trainingItem] = await waitForAll([
    modelDao.load({ profileId, modelId }),
    trainingDao.load({ modelId }),
  ]);

  logger.info('RetryTraining requested', {
    modelId,
    modelStatus: modelItem.status,
    trainingStatus: trainingItem.status,
  });

  if (TERMINAL_MODEL_STATUSES.includes(modelItem.status)) {
    throw new BadRequestError({ message: 'Model is not eligible for retry' });
  }

  if (trainingItem.sageMakerJobArn) {
    // A SageMaker job already exists for this training job, so retrying would create a second one.
    throw new ConflictError({ message: 'Model is not in WAITING_FOR_CAPACITY state' });
  }

  if (modelItem.status !== ModelStatus.WAITING_FOR_CAPACITY || trainingItem.status !== JobStatus.WAITING_FOR_CAPACITY) {
    throw new ConflictError({ message: 'Model is not in WAITING_FOR_CAPACITY state' });
  }

  const { status, message } = await trainingDispatchHelper.dispatchIfCapacityAvailable({
    modelId,
    profileId,
    jobName: trainingItem.name,
  });

  return { modelId, status, message } satisfies RetryTrainingServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getRetryTrainingHandler(instrumentOperation(RetryTrainingOperation)));
