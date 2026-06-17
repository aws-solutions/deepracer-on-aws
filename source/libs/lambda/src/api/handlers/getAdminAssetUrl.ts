// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, profileDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetAdminAssetUrlHandler,
  GetAdminAssetUrlServerInput,
  GetAdminAssetUrlServerOutput,
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

  if (!modelItem.assetS3Locations.modelArtifactS3Location) {
    throw new NotFoundError({ message: 'Unable to find physical model artifact.' });
  }

  const profileItem = await profileDao.load({ profileId });

  const filename = `${profileItem.alias}_${modelItem.name}.tar.gz`;

  const url = await s3Helper.getPresignedUrl(modelItem.assetS3Locations.modelArtifactS3Location, 300, filename);

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
