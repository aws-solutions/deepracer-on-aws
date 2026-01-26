// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PassThrough } from 'node:stream';

import { Upload } from '@aws-sdk/lib-storage';
import { AmazonS3URI, logger, logMethod, s3Client, s3Helper, waitForAll } from '@deepracer-indy/utils';
import archiver from 'archiver';

export interface FileToArchive {
  filename: string;
  s3Location: string;
}

export class S3Archiver {
  @logMethod
  async createS3Archive(filesToArchive: FileToArchive[], archiveS3Destination: string) {
    try {
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: {
          level: 6,
        },
      });
      const passThroughStream = new PassThrough();
      archive.pipe(passThroughStream);

      archive.on('error', (err: archiver.ArchiverError) => {
        logger.error('Archive error:', { error: err });
        throw err;
      });

      archive.on('warning', (err: archiver.ArchiverError) => {
        if (err.code === 'ENOENT') {
          logger.warn('Archive warning:', { error: err });
        } else {
          logger.error('Archive error:', { error: err });
          throw err;
        }
      });

      archive.on('progress', (progress) => {
        logger.info(`Archive progress: ${progress.entries.processed}/${progress.entries.total} files`);
      });

      const archiveDestinationS3Uri = new AmazonS3URI(archiveS3Destination);

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: archiveDestinationS3Uri.bucket,
          Key: archiveDestinationS3Uri.key,
          Body: passThroughStream,
          ContentType: 'application/gzip',
        },
      });

      upload.on('httpUploadProgress', (progress) => {
        logger.info('Upload progress', { progress });
      });

      const uploadPromise = upload.done();

      const batchSize = 2;
      for (let i = 0; i < filesToArchive.length; i += batchSize) {
        const batch = filesToArchive.slice(i, i + batchSize);

        await waitForAll(
          batch.map(async (fileDetails) => {
            logger.info('Adding file to archive', { filename: fileDetails.filename });

            const fileStream = await s3Helper.getReadableObjectFromS3(fileDetails.s3Location);

            archive.append(fileStream, { name: fileDetails.filename });
          }),
        );
      }

      await archive.finalize();
      return await uploadPromise;
    } catch (error) {
      logger.error('Error occurred while creating archive', { error: error as Error });
      throw error;
    }
  }
}

export const s3Archiver = new S3Archiver();
