// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, trainingDao } from '@deepracer-indy/database';
import {
  getListModelsHandler,
  InternalFailureError,
  ListModelsServerInput,
  ListModelsServerOutput,
  Model,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, waitForAll } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** This is the implementation of business logic of the ListModels operation. */
export const ListModelsOperation: Operation<ListModelsServerInput, ListModelsServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;
  const { token } = input;

  // Get all models
  const { cursor, data: modelItems } = await modelDao.list({
    profileId,
    cursor: token,
  });

  // Get all training items for all models
  const trainingItems = await trainingDao.batchGet(
    modelItems.map((modelItem) => ({
      profileId: modelItem.profileId,
      modelId: modelItem.modelId,
    })),
  );

  const models = await waitForAll(
    modelItems.map(async (modelItem): Promise<Model> => {
      const trainingItem = trainingItems.find((item) => item.modelId === modelItem.modelId);

      // Each model should have a corresponding training item attached to it, if not then error
      if (!trainingItem) {
        throw new InternalFailureError({ message: 'Training item not found.' });
      }

      return {
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
      };
    }),
  );

  return { models, token: cursor ?? undefined } satisfies ListModelsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getListModelsHandler(instrumentOperation(ListModelsOperation)));
