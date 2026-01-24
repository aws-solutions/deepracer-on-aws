// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { profileDao, ResourceId } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { s3Client } from '@deepracer-indy/utils/src/clients/s3Client';
import { S3Event } from 'aws-lambda';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

export const UpdateStorageUsedByProfile = async (event: S3Event) => {
  logger.info('UpdateStorageUsedByProfile lambda start', { input: event });

  const profileId = getProfileIdFromS3Event(event);

  try {
    const storageUsed = await calculateStorageUsed(profileId);
    const numberOfModels = await getModelCount(profileId);

    await updateProfileStorageData(profileId, storageUsed, numberOfModels);
  } catch (err) {
    throw new InternalFailureError({
      message: 'Failed to get storage metrics for requested profile',
    });
  }
};

/**
 * Parses the profile ID from the S3 event.
 * @param event - the S3 event.
 * @returns the profile ID.
 */
const getProfileIdFromS3Event = (event: S3Event) => {
  const objectKey = event.Records[0].s3.object.key.split('/');
  const profileId = objectKey[0];
  return profileId as ResourceId;
};

/**
 * Calculate the amount of storage used by a given profile in S3.
 * @param profileId - the ID of the profile.
 * @returns the amount of storage used by the profile in bytes.
 */
const calculateStorageUsed = async (profileId: ResourceId) => {
  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const req: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: process.env.MODEL_STORAGE_BUCKET_NAME,
      Prefix: `${profileId}/`,
      ContinuationToken: continuationToken,
    });

    const res = await s3Client.send(req);

    if (res.Contents) {
      totalSize += res.Contents.reduce((acc, obj) => acc + (obj.Size || 0), 0);
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return totalSize;
};

/**
 * Count the number of models associated with a given profile and return the result.
 * @param profileId - the ID of the profile.
 * @returns the number of models associated with the profile.
 */
const getModelCount = async (profileId: ResourceId) => {
  const req: ListObjectsV2Command = new ListObjectsV2Command({
    Bucket: process.env.MODEL_STORAGE_BUCKET_NAME,
    Prefix: `${profileId}/models/`,
    Delimiter: '/',
  });

  try {
    const res = await s3Client.send(req);
    return res.KeyCount || 0;
  } catch (err) {
    throw new InternalFailureError({
      message: 'Failed to get number of models for requested profile',
    });
  }
};

/**
 * Update the `storageUsed` and `modelCount` fields of a given profile in the database.
 * @param profileId - the ID of the profile to update.
 * @param storageUsed - the amount of storage used by the profile in bytes.
 * @param modelCount - the number of models associated with the profile.
 */
const updateProfileStorageData = async (profileId: ResourceId, storageUsed: number, modelCount: number) => {
  await profileDao.update(
    { profileId },
    {
      modelStorageUsage: storageUsed,
      modelCount: modelCount,
    },
  );
};

export const lambdaHandler = instrumentHandler(UpdateStorageUsedByProfile);
