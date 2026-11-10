// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, ResourceId, trainingDao } from '@deepracer-indy/database';
import {
  getGetModelHandler,
  GetModelServerInput,
  GetModelServerOutput,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, waitForAll } from '@deepracer-indy/utils';

import { checkpointHelper } from '../../utils/CheckpointHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** This is the implementation of business logic of the GetModel operation. */
export const GetModelOperation: Operation<GetModelServerInput, GetModelServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;
  const modelId = input.modelId as ResourceId;

  const [modelItem, trainingItem] = await waitForAll([
    modelDao.load({ profileId, modelId }),
    trainingDao.load({ modelId }),
  ]);

  // Checkpoints are only chosen for a READY model, so a model still training or importing, which the
  // console polls, is not read for them.
  const checkpoints =
    modelItem.status === ModelStatus.READY
      ? await checkpointHelper.getModelCheckpoints(
          { profileId, modelId },
          // Only a training job this solution ran has a SageMaker job; an imported model's training
          // item is created as already completed.
          { includeCompletion: Boolean(trainingItem.sageMakerJobArn) },
        )
      : undefined;

  return {
    model: {
      carCustomization: modelItem.carCustomization,
      createdAt: new Date(modelItem.createdAt),
      description: modelItem.description,
      fileSizeInBytes: modelItem.fileSizeInBytes,
      metadata: modelItem.metadata,
      modelId: modelItem.modelId,
      modelSource: modelItem.modelSource,
      name: modelItem.name,
      optimizationStatus: modelItem.optimizationStatus,
      status: modelItem.status,
      importErrorMessage: modelItem.importErrorMessage,
      statusMessage: modelItem.statusMessage,
      trainingConfig: {
        maxTimeInMinutes: trainingItem.terminationConditions.maxTimeInMinutes,
        minEvalTrials: trainingItem.minEvalTrials,
        objectAvoidanceConfig: trainingItem.objectAvoidanceConfig,
        raceType: trainingItem.raceType,
        trackConfig: trainingItem.trackConfig,
      },
      trainingStatus: trainingItem.status,
      trainingMetricsUrl: await s3Helper.getPresignedUrl(trainingItem.assetS3Locations.metricsS3Location),
      trainingVideoStreamUrl: trainingItem.videoStreamUrl,
    },
    checkpoints,
  } satisfies GetModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetModelHandler(instrumentOperation(GetModelOperation)));
