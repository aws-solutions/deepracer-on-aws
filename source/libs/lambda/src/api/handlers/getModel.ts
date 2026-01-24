// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, ResourceId, trainingDao } from '@deepracer-indy/database';
import {
  getGetModelHandler,
  GetModelServerInput,
  GetModelServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, waitForAll } from '@deepracer-indy/utils';

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

  return {
    model: {
      carCustomization: modelItem.carCustomization,
      createdAt: new Date(modelItem.createdAt),
      description: modelItem.description,
      fileSizeInBytes: modelItem.fileSizeInBytes,
      metadata: modelItem.metadata,
      modelId: modelItem.modelId,
      name: modelItem.name,
      status: modelItem.status,
      importErrorMessage: modelItem.importErrorMessage,
      trainingConfig: {
        maxTimeInMinutes: trainingItem.terminationConditions.maxTimeInMinutes,
        objectAvoidanceConfig: trainingItem.objectAvoidanceConfig,
        raceType: trainingItem.raceType,
        trackConfig: trainingItem.trackConfig,
      },
      trainingStatus: trainingItem.status,
      trainingMetricsUrl: await s3Helper.getPresignedUrl(trainingItem.assetS3Locations.metricsS3Location),
      trainingVideoStreamUrl: trainingItem.videoStreamUrl,
    },
  } satisfies GetModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetModelHandler(instrumentOperation(GetModelOperation)));
