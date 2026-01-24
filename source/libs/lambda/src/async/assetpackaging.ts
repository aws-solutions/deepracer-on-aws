// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { PassThrough } from 'stream';

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { modelDao, ResourceId } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, logger, s3Helper } from '@deepracer-indy/utils';
import archiver from 'archiver';
import type { Context, Handler } from 'aws-lambda';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

const s3Client = new S3Client({ region: process.env.REGION });

const sourceBucket = process.env.SOURCE_BUCKET;
const destBucket = process.env.DEST_BUCKET;
const MEGABYTE_IN_BYTES = 1024 * 1024;
const partSize = 15 * MEGABYTE_IN_BYTES;

interface CompressRequest {
  sourcePrefix: string;
  requestContext?: {
    requestId: string;
  };
}

/**
 * Generates the destination S3 key for the compressed zip file
 * @param sourcePrefix - The S3 prefix where source objects are located
 * @returns The S3 key for the destination zip file
 */
function generateDestKey(sourcePrefix: string): string {
  const filePath = `${sourcePrefix.replace(/\/$/, '')}/virtualmodel.zip`;
  return filePath;
}

/**
 * Converts bytes to megabytes with 2 decimal places
 * @param bytes - The size in bytes
 * @returns A string representation of the size in MB
 */
function convertToMB(bytes: number): string {
  return `${(bytes / MEGABYTE_IN_BYTES).toFixed(2)} MB`;
}

/**
 * Initiates a multipart upload to S3 for the compressed file
 * @param destKey - The destination S3 key
 * @param passThrough - The PassThrough stream containing the file data
 * @returns A promise that resolves when the upload is complete
 */
function multiPartUpload(destKey: string, passThrough: PassThrough) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: destBucket,
      Key: destKey,
      Body: passThrough,
      ContentType: 'application/zip',
    },
    queueSize: 5,
    partSize,
    leavePartsOnError: false,
  });

  upload.on('httpUploadProgress', (progress) => {
    if (progress.loaded) {
      logger.info(`Upload progress: ${convertToMB(progress.loaded)} transferred`);
    }
  });

  const uploadPromise = upload.done();
  return uploadPromise;
}

/**
 * Compresses files from a source S3 prefix and transfers them to a destination bucket
 * @param request - The compression request containing source prefix
 * @returns The destination S3 key where the compressed file was uploaded
 * @throws Error if source/destination buckets are not defined or if no objects are found
 */
async function compressAndTransferDirectory(request: CompressRequest): Promise<string> {
  const destKey = generateDestKey(request.sourcePrefix);

  try {
    if (!sourceBucket || !destBucket) {
      throw new Error('SOURCE_BUCKET and DEST_BUCKET are required environment variables');
    }

    const listResponse = await s3Helper.listObjects(sourceBucket, request.sourcePrefix);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      throw new Error('No objects found in the specified directory');
    }

    const archive = archiver('zip', {
      zlib: { level: 6 },
      forceZip64: true,
    });

    const passThrough = new PassThrough();

    // Archive Error handling
    archive.on('error', (err: archiver.ArchiverError) => {
      throw err;
    });

    archive.on('warning', (err: archiver.ArchiverError) => {
      if (err.code === 'ENOENT') {
        logger.warn('Archive warning:', { error: err });
      } else {
        throw err;
      }
    });

    // Progress monitoring
    archive.on('progress', (progress) => {
      logger.info(`Archive progress: ${progress.entries.processed}/${progress.entries.total} files`);
    });

    // Multi-part Upload to S3
    const uploadPromise = multiPartUpload(destKey, passThrough);

    // Pipe archive to passthrough
    archive.pipe(passThrough);

    // Process files
    for (const object of listResponse.Contents) {
      if (!object.Key || object.Key === request.sourcePrefix) continue;

      // Skip files in sim-trace, videos directories and output directory
      if (object.Key.includes('/sim-trace/') || object.Key.includes('/videos/') || object.Key.includes('/output/')) {
        logger.info(`Skipping excluded directory file: ${object.Key}`);
        continue;
      }

      logger.info(`Processing file: ${object.Key}`, { size: object.Size });

      const s3Url = new AmazonS3URI(`s3://${sourceBucket}/${object.Key}`);
      const stream = await s3Helper.getReadableObjectFromS3(s3Url);

      const sourcePrefixLength = request.sourcePrefix.length;
      const assetPathExcludingPrefix = object.Key.slice(sourcePrefixLength);
      const sanitizedAssetPath = removeSagemakerArtifacts(assetPathExcludingPrefix);

      // Processing file stream
      await new Promise<void>((resolve, reject) => {
        stream.on('error', (error) => {
          logger.error(`Stream error for ${object.Key}:`, { error });
          reject(error);
        });

        stream.on('end', () => {
          logger.debug(`Finished streaming: ${sanitizedAssetPath}`);
          resolve();
        });

        archive.append(stream, {
          name: sanitizedAssetPath,
          date: object.LastModified,
        });
      });
    }

    // Finalize the archive after all files are processed
    logger.info('All files processed, finalizing archive...');
    await archive.finalize();

    logger.info('Archive finalized, waiting for upload to complete...');
    await uploadPromise;

    logger.info('Successfully compressed and transferred', {
      sourceBucket,
      destBucket,
      sourcePrefix: request.sourcePrefix,
      destKey,
    });

    return destKey;
  } catch (error) {
    logger.error('Error during compression and transfer:', {
      error,
      sourceBucket,
      destBucket,
      sourcePrefix: request.sourcePrefix,
      destKey,
    });
    throw error;
  }
}

/**
 * Removes SageMaker artifact prefixes from file paths
 * @param assetPathWithoutPrefix - The relative path that may contain SageMaker artifacts
 * @returns The cleaned path with SageMaker artifact prefixes removed
 */
export function removeSagemakerArtifacts(assetPathWithoutPrefix: string) {
  const sanitizedAssetPath = assetPathWithoutPrefix.replace(/sagemaker-artifacts\//g, '');
  logger.info(`Adding to archive with path: ${sanitizedAssetPath}`);
  return sanitizedAssetPath;
}

/**
 * Lambda handler for asset packaging process
 * @param event - The compression request event
 * @param context - The Lambda execution context
 * @returns Object containing the S3 location of the virtual model artifact
 * @throws Error if compression or database update fails
 */
export async function handler(
  event: CompressRequest,
  context: Context,
): Promise<{ virtualModelArtifactS3Location: string }> {
  logger.info(`Event: ${JSON.stringify(event)}`);
  const prefixParts = event.sourcePrefix.split('/');
  const profileId = prefixParts[0] as ResourceId;
  const modelId = prefixParts[2] as ResourceId;

  try {
    const startTime = Date.now();
    logger.info(`Asset Packaing started at: ${new Date().toISOString()}`);
    const destKey = await compressAndTransferDirectory(event);

    const virtualModelArtifactS3Location = `s3://${destBucket}/${destKey}`;

    logger.info('Updating model with virtual model artifact location', {
      modelId,
      profileId,
      virtualModelArtifactS3Location,
    });

    await modelDao.update(
      { modelId, profileId },
      {
        packagingStatus: ModelStatus.READY,
        packagedAt: new Date().toISOString(),
        // Typecast to any is required due to an issue with ElectroDB's types
        ['assetS3Locations.virtualModelArtifactS3Location' as any]: virtualModelArtifactS3Location, // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    );
    const endTime = Date.now();
    logger.info(`Total packaging time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    return { virtualModelArtifactS3Location };
  } catch (error) {
    const awsRequestId = context.awsRequestId;
    await modelDao.update(
      { modelId, profileId },
      {
        packagingStatus: ModelStatus.ERROR,
        // Typecast to any is required due to an issue with ElectroDB's types
        ['assetS3Locations.virtualModelArtifactS3Location' as any]: '', // eslint-disable-line @typescript-eslint/no-explicit-any
        packagingErrorRequestId: awsRequestId,
      },
    );
    logger.error('Error occurred in Asset Packaing:', { error });
    throw error;
  }
}

export const lambdaHandler: Handler<CompressRequest, { virtualModelArtifactS3Location: string }> =
  instrumentHandler(handler);
