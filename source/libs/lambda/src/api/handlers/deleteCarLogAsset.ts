// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { carLogAssetDao, carLogPaths, type ResourceId } from '@deepracer-indy/database';
import {
  DeleteCarLogAssetServerInput,
  DeleteCarLogAssetServerOutput,
  getDeleteCarLogAssetHandler,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { getCarLogAccess, requireCarLogEnv } from '../utils/carLogAccess.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `DELETE /car-logs/assets/{profileId}/{assetId}` — delete a bag or video (its owner,
 * Administrators and Race Facilitators). The stored objects go first, then the row, so a failure
 * midway never leaves an entry without a way to retry.
 */
export const DeleteCarLogAssetOperation: Operation<
  DeleteCarLogAssetServerInput,
  DeleteCarLogAssetServerOutput,
  HandlerContext
> = async (input, context) => {
  const ownerProfileId = input.profileId as ResourceId;
  const access = await getCarLogAccess(context.profileId);
  // Same message as a missing asset so the existence of other racers' assets is not revealed.
  if (access === 'viewer' || (access === 'racer' && context.profileId !== ownerProfileId)) {
    throw new NotAuthorizedError({ message: 'You are not allowed to delete this asset.' });
  }

  const bucket = requireCarLogEnv('DEVICE_LOGS_BUCKET_NAME');
  const asset = await carLogAssetDao.get({ profileId: ownerProfileId, assetId: input.assetId });
  if (!asset) {
    throw new NotFoundError({ message: 'Asset not found.' });
  }

  if (!asset.s3Key.startsWith(carLogPaths.profilePrefix(ownerProfileId))) {
    logger.error('Asset key outside of the owner prefix', { assetId: asset.assetId, profileId: ownerProfileId });
    throw new InternalFailureError({ message: 'Failed to delete the asset.' });
  }

  await s3Helper.deleteS3Location(`s3://${bucket}/${asset.s3Key}`);
  await carLogAssetDao.delete({ profileId: ownerProfileId, assetId: asset.assetId });

  logger.info('Car log asset deleted', { action: 'CAR_LOG_ASSET_DELETE', assetId: asset.assetId, ownerProfileId });
  return {} satisfies DeleteCarLogAssetServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getDeleteCarLogAssetHandler(instrumentOperation(DeleteCarLogAssetOperation)),
);
