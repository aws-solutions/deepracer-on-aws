// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from 'stream';

import {
  _Object,
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  NoSuchKey,
  paginateListObjectsV2,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StreamingBlobPayloadInputTypes } from '@smithy/types';

import { s3Client } from '#clients/s3Client.js';
import { logMethod } from '#decorators/logMethod.js';
import { logger } from '#powertools/powertools.js';
import { AmazonS3URI } from '#s3/AmazonS3URI.js';

export class S3Helper {
  DEFAULT_PRESIGNED_URL_EXPIRE_TIME = 60 * 60; // 1 hour in seconds

  /**
   * Retrieves an S3 object and returns its contents as a string
   * @param location S3 location as string or AmazonS3URI object
   * @param throwOnMissingObject Whether to throw an error if the object doesn't exist
   * @returns The object contents as a string
   */
  @logMethod
  async getObjectAsStringFromS3(location: string | AmazonS3URI, throwOnMissingObject = true) {
    const s3Location = location instanceof AmazonS3URI ? location : new AmazonS3URI(location);

    try {
      const response = await s3Client.send(new GetObjectCommand({ Bucket: s3Location.bucket, Key: s3Location.key }));
      const contentString = await response.Body?.transformToString();
      return contentString ?? '';
    } catch (error) {
      if (error instanceof NoSuchKey && !throwOnMissingObject) {
        logger.warn('S3 object does not exist.', { s3Location });
        return '';
      }
      logger.error('Unable to get object as string from S3', { s3Location, error });
      throw error;
    }
  }

  /**
   * Retrieves an S3 object as a readable stream
   * @param location S3 location as string or AmazonS3URI object
   * @returns A readable stream of the object's contents
   */
  async getReadableObjectFromS3(location: string | AmazonS3URI): Promise<Readable> {
    const s3Location = location instanceof AmazonS3URI ? location : new AmazonS3URI(location);

    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: s3Location.bucket,
          Key: s3Location.key,
        }),
      );

      if (!response.Body) {
        logger.warn('No body received from S3 object', { s3Location });
        throw new Error(`No body received from S3 object at ${s3Location.bucket}/${s3Location.key}`);
      }

      return response.Body as Readable;
    } catch (error) {
      logger.error('Unable to get object from S3', { s3Location, error });
      throw error;
    }
  }

  /**
   * Lists objects in an S3 bucket with the specified prefix
   * @param bucket S3 bucket name
   * @param prefix Key prefix to filter objects
   * @returns List of objects matching the prefix
   */
  async listObjects(bucket: string, prefix: string): Promise<ListObjectsV2CommandOutput> {
    try {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        }),
      );

      return listResponse;
    } catch (error) {
      logger.error('Failed to list objects from S3', { bucket, prefix, error });
      throw error;
    }
  }

  /**
   * Generates a presigned URL for an S3 object
   * @param location S3 location as string
   * @param expiresIn URL expiration time in seconds
   * @param downloadFilename Optional filename for Content-Disposition header
   * @returns Presigned URL for the S3 object
   */
  async getPresignedUrl(
    location: string,
    expiresIn = this.DEFAULT_PRESIGNED_URL_EXPIRE_TIME,
    downloadFilename?: string,
  ) {
    const s3Location = new AmazonS3URI(location);
    const sanitizedFilename = downloadFilename?.replace(/[\r\n"\\;]/g, '_');
    logger.info('Generating presigned URL', { s3Location, expiresIn, downloadFilename: sanitizedFilename });

    try {
      const presignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: s3Location.bucket,
          Key: s3Location.key,
          ResponseContentDisposition: sanitizedFilename ? `attachment; filename="${sanitizedFilename}"` : undefined,
        }),
        { expiresIn },
      );

      return presignedUrl;
    } catch (error) {
      logger.error('Unable to generate presigned URL', { s3Location, error });
      throw error;
    }
  }

  /**
   * Writes content to an S3 location
   * @param content Content to write
   * @param location S3 location as string or AmazonS3URI object
   * @returns Result of the upload operation
   */
  async writeToS3(content: StreamingBlobPayloadInputTypes, location: string | AmazonS3URI) {
    const s3Location = location instanceof AmazonS3URI ? location : new AmazonS3URI(location);
    logger.info('writeToS3', { s3Location });

    try {
      const uploader = new Upload({
        client: s3Client,
        params: { Bucket: s3Location.bucket, Key: s3Location.key, Body: content },
      });

      uploader.on('httpUploadProgress', (progress) => {
        logger.info('Upload progress', { progress });
      });

      const uploadResponse = await uploader.done();

      logger.info('writeToS3 upload complete');

      return uploadResponse;
    } catch (error) {
      logger.error('Unable to write to S3', { s3Location, error });
      throw error;
    }
  }

  /**
   * Deletes objects at the specified S3 location
   * @param location S3 location as string or AmazonS3URI object
   */
  async deleteS3Location(location: string | AmazonS3URI) {
    const s3Location = location instanceof AmazonS3URI ? location : new AmazonS3URI(location);
    logger.info('deleteS3Location', { s3Location });

    try {
      const paginator = paginateListObjectsV2(
        { client: s3Client },
        {
          Bucket: s3Location.bucket,
          Prefix: s3Location.key,
        },
      );

      const objectKeys = [];
      for await (const { Contents } of paginator) {
        const deleteableContent = Contents?.map((obj: _Object) => ({ Key: obj.Key })) ?? [];
        objectKeys.push(...deleteableContent);
      }

      logger.info('Deleting objects', { bucket: s3Location.bucket, objectKeys });

      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: s3Location.bucket,
          Delete: { Objects: objectKeys },
        }),
      );
    } catch (error) {
      logger.error('Failed to delete objects', { s3Location });
      throw error;
    }
  }

  /**
   * Copies an object from one S3 location to another
   * @param sourceBucket Source S3 bucket name
   * @param sourceKey Source object key
   * @param destinationBucket Destination S3 bucket name
   * @param destinationKey Destination object key
   * @returns Result of the copy operation
   */
  async copyObject(sourceBucket: string, sourceKey: string, destinationBucket: string, destinationKey: string) {
    logger.info('Copying S3 object', { sourceBucket, sourceKey, destinationBucket, destinationKey });

    try {
      const command = new CopyObjectCommand({
        CopySource: `${sourceBucket}/${sourceKey}`,
        Bucket: destinationBucket,
        Key: destinationKey,
      });

      return await s3Client.send(command);
    } catch (error) {
      logger.error('Failed to copy S3 object', { sourceBucket, sourceKey, destinationBucket, destinationKey, error });
      throw error;
    }
  }
}

export const s3Helper = new S3Helper();
