// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, profileDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetAdminAssetUrlHandler,
  GetAdminAssetUrlServerInput,
  GetAdminAssetUrlServerOutput,
  InternalFailureError,
  ModelStatus,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger, s3Helper } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const GetAdminAssetUrlOperation: Operation<
  GetAdminAssetUrlServerInput,
  GetAdminAssetUrlServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.info('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const profileId = input.profileId as ResourceId;
  const modelId = input.modelId as ResourceId;

  const modelItem = await modelDao.load({ profileId, modelId });

  if (modelItem.status !== ModelStatus.READY) {
    throw new NotFoundError({ message: 'Model is not ready for download.' });
  }

  const profileItem = await profileDao.load({ profileId });
  const filename = `${profileItem.alias}_${modelItem.name}.tar.gz`;

  let url: string;

  if (modelItem.assetS3Locations.modelArtifactS3Location) {
    // Virtual/trained models: SageMaker artifact
    url = await s3Helper.getPresignedUrl(modelItem.assetS3Locations.modelArtifactS3Location, 300, filename);
  } else if (modelItem.optimizedArtifactsS3Prefix) {
    // Imported physical models: serve the preserved original archive
    const bucket = process.env.MODEL_DATA_BUCKET_NAME;
    if (!bucket) {
      logger.error('Missing required environment variable', { variable: 'MODEL_DATA_BUCKET_NAME' });
      throw new InternalFailureError({ message: 'Service configuration error.' });
    }
    logger.info('Generating presigned URL for imported physical model.');
    url = await s3Helper.getPresignedUrl(
      `s3://${bucket}/${modelItem.optimizedArtifactsS3Prefix}original-model.tar.gz`,
      300,
      filename,
    );
  } else {
    throw new NotFoundError({ message: 'Unable to find model artifact.' });
  }

  metricsLogger.logDownloadModel({ modelId });

  logger.info('Admin model download', {
    action: 'ADMIN_MODEL_DOWNLOAD',
    adminProfileId: context.profileId,
    targetProfileId: profileId,
    modelId,
    modelName: modelItem.name,
    targetAlias: profileItem.alias,
  });

  return { url, filename };
};

export const lambdaHandler = getApiGatewayHandler(
  getGetAdminAssetUrlHandler(instrumentOperation(GetAdminAssetUrlOperation)),
);
