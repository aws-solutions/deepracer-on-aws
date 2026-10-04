// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { carLogAssetDao, carLogPaths, type CarLogAssetItem, type ResourceId } from '@deepracer-indy/database';
import {
  CarLogAssetType,
  CarLogAssetUrl,
  CarLogAssetUrlError,
  GetCarLogAssetUrlsServerInput,
  GetCarLogAssetUrlsServerOutput,
  getGetCarLogAssetUrlsHandler,
} from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import { isSafePathSegment } from '../../car-logs/utils/tarSafety.js';
import { s3Archiver } from '../../utils/S3Archiver.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { type CarLogAccess, getCarLogAccess, requireCarLogEnv } from '../utils/carLogAccess.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const URL_TTL_SECONDS = 5 * 60;

const FORBIDDEN = { code: 'FORBIDDEN', message: 'You are not allowed to access this asset.' };

/** Returns an error entry when the caller may not download the asset, otherwise undefined. */
const checkAccess = (access: CarLogAccess, callerId: ResourceId, asset: CarLogAssetItem) => {
  if (access === 'manager' || callerId === asset.profileId) {
    return undefined;
  }
  // Commentators may watch videos but cannot take raw bags.
  return access === 'viewer' && asset.assetType === CarLogAssetType.VIDEO ? undefined : FORBIDDEN;
};

/**
 * `POST /car-logs/assets/urls` — short-lived download URLs for up to 25 assets.
 *
 * Partial success: assets that are missing or not allowed come back in `errors` (with the same
 * response for "missing" and "not yours" to racers) while the others still get URLs. Videos are
 * presigned directly; a bag is a folder, so it is archived into a single file first.
 */
export const GetCarLogAssetUrlsOperation: Operation<
  GetCarLogAssetUrlsServerInput,
  GetCarLogAssetUrlsServerOutput,
  HandlerContext
> = async (input, context) => {
  const access = await getCarLogAccess(context.profileId);
  const bucket = requireCarLogEnv('DEVICE_LOGS_BUCKET_NAME');

  const urls: CarLogAssetUrl[] = [];
  const errors: CarLogAssetUrlError[] = [];

  await Promise.all(
    input.assets.map(async ({ profileId, assetId }) => {
      const fail = (error: { code: string; message: string }): void => {
        errors.push({ assetId, ...error });
      };
      try {
        const asset = await carLogAssetDao.get({ profileId: profileId as ResourceId, assetId });
        const denied = asset ? checkAccess(access, context.profileId, asset) : undefined;
        if (!asset || (denied && access === 'racer')) {
          return fail({ code: 'NOT_FOUND', message: 'Asset not found.' });
        }
        if (denied) {
          return fail(denied);
        }
        if (!asset.s3Key.startsWith(carLogPaths.profilePrefix(asset.profileId))) {
          logger.error('Asset key outside of the owner prefix', { assetId, profileId });
          return fail({ code: 'INTERNAL', message: 'The asset cannot be downloaded.' });
        }

        if (asset.assetType === CarLogAssetType.VIDEO) {
          const url = await s3Helper.getPresignedUrl(
            `s3://${bucket}/${asset.s3Key}`,
            URL_TTL_SECONDS,
            asset.filename,
            'video/mp4',
          );
          urls.push({ assetId, url, filename: asset.filename });
          return;
        }

        const filename = `${asset.filename}.tar.gz`;
        const archiveKey = carLogPaths.downloadKey(assetId, filename);
        const listing = await s3Helper.listObjects(bucket, asset.s3Key);
        const prefixLength = asset.s3Key.length;
        const files = (listing.Contents ?? [])
          .flatMap((object) =>
            object.Key &&
            !object.Key.endsWith('/') &&
            object.Key.slice(prefixLength).split('/').every(isSafePathSegment)
              ? [object.Key]
              : [],
          )
          .map((key) => ({
            filename: `${asset.filename}/${key.slice(prefixLength)}`,
            s3Location: `s3://${bucket}/${key}`,
          }));
        if (files.length === 0) {
          return fail({ code: 'NOT_FOUND', message: 'The asset has no files.' });
        }
        await s3Archiver.createS3Archive(files, `s3://${bucket}/${archiveKey}`);
        const url = await s3Helper.getPresignedUrl(`s3://${bucket}/${archiveKey}`, URL_TTL_SECONDS, filename);
        urls.push({ assetId, url, filename });
      } catch (error) {
        logger.error('Failed to create car log asset URL', { assetId, profileId, error });
        fail({ code: 'INTERNAL', message: 'The download could not be prepared.' });
      }
    }),
  );

  return { urls, errors } satisfies GetCarLogAssetUrlsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetCarLogAssetUrlsHandler(instrumentOperation(GetCarLogAssetUrlsOperation)),
);
