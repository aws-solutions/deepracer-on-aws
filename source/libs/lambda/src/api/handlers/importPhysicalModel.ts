// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import { generateResourceId, modelDao, profileDao, ResourceId, trainingDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  getImportPhysicalModelHandler,
  ImportPhysicalModelServerInput,
  ImportPhysicalModelServerOutput,
  InternalFailureError,
  JobStatus,
  ModelMetadata,
  ModelSource,
  ModelStatus,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { s3Client } from '#utils/clients/s3Client.js';
import { sqsClient } from '#utils/clients/sqsClient.js';

import { usageQuotaHelper } from '../../utils/UsageQuotaHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { validateModelCountLimit } from '../utils/validation.js';

const PHYSICAL_UPLOAD_PREFIX = 'uploads/physical-models';

/**
 * Physical model imports don't have metadata at creation time. The Model Optimizer
 * populates these fields after processing the archive (model_metadata.json).
 * While IMPORTING, GetModel/ListModels return empty metadata for this model.
 */
const PHYSICAL_IMPORT_INITIAL_METADATA = {} as ModelMetadata;

/**
 * Initiates a physical model import from a user-uploaded tar.gz archive.
 *
 * Validates the upload target (bucket + path prefix scoped to caller's profile), confirms
 * the file exists via HeadObject, and enforces the model count quota. Creates a model record
 * with IMPORTING status and dispatches a message to the import job queue. The Model Optimizer
 * Lambda processes the archive asynchronously (extracts metadata, converts to IR/TFLite,
 * transitions status to READY or ERROR).
 */
export const ImportPhysicalModelOperation: Operation<
  ImportPhysicalModelServerInput,
  ImportPhysicalModelServerOutput,
  HandlerContext
> = async (input, context) => {
  const { s3Bucket, s3Path, modelName } = input;
  const { profileId } = context;

  // Validate upload target matches configured bucket and caller's profile prefix
  const uploadBucket = process.env.UPLOAD_BUCKET_NAME;
  if (!uploadBucket) {
    logger.error('Missing required environment variable', { variable: 'UPLOAD_BUCKET_NAME' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }
  const expectedPrefix = `${PHYSICAL_UPLOAD_PREFIX}/${profileId}/`;
  if (s3Bucket !== uploadBucket || !s3Path.startsWith(expectedPrefix)) {
    logger.warn('Upload target validation failed', { s3Bucket, s3Path, expectedPrefix, profileId });
    throw new NotAuthorizedError({ message: 'Access denied.' });
  }

  // Confirm upload exists via HeadObject
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: s3Path }));
  } catch (error: unknown) {
    const code = (error as { name?: string }).name;
    if (code === 'NotFound' || code === 'NoSuchKey') {
      throw new BadRequestError({ message: 'Upload not found. Ensure the file has been uploaded before importing.' });
    }
    throw error;
  }

  // Enforce model count quota (model-count only; physical imports use no compute minutes)
  const profileQuota = await usageQuotaHelper.loadProfileComputeUsage(profileId);
  validateModelCountLimit(profileQuota);

  // Validate required env var before creating any state
  const queueUrl = process.env.IMPORT_MODEL_JOB_QUEUE_URL;
  if (!queueUrl) {
    logger.error('Missing required environment variable', { variable: 'IMPORT_MODEL_JOB_QUEUE_URL' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  // Create model and training records. Physical models were trained externally so training
  // fields use placeholder values. This matches the virtual import pattern (importModel.ts)
  // and ensures GetModel/ListModels work without branching on modelSource.
  //
  // Sequential creates: model first, so a training failure lets us cleanly compensate.
  const modelId = generateResourceId() as ResourceId;
  const s3Location = `s3://${s3Bucket}/${s3Path}`;

  await modelDao.create({
    modelId,
    profileId,
    name: modelName,
    description: '',
    status: ModelStatus.IMPORTING,
    modelSource: ModelSource.IMPORTED_PHYSICAL,
    // Metadata is unknown at import time for physical models. The Model Optimizer
    // reads model_metadata.json from the archive and updates the record after processing.
    metadata: PHYSICAL_IMPORT_INITIAL_METADATA,
    carCustomization: { carShell: 'DEEPRACER', carColor: 'BLACK' },
  });

  try {
    await trainingDao.create({
      modelId,
      profileId,
      raceType: 'TIME_TRIAL',
      status: JobStatus.COMPLETED,
      terminationConditions: { maxTimeInMinutes: 0 },
      trackConfig: { trackId: 'reInvent2019_wide', trackDirection: 'CLOCKWISE' },
    });
  } catch (error) {
    logger.error('Failed to create training record, rolling back model record', { modelId, profileId, error });
    // Delete failure surfaced via @logMethod on BaseDao.delete
    await modelDao.delete({ modelId, profileId }).catch(() => {
      /* @logMethod surfaces failures */
    });
    throw error;
  }

  logger.info('Physical model import initiated', { modelId, profileId, s3Location });

  // Increment monthly model count alongside record creation.
  const newModelCount = (profileQuota.modelCount ?? 0) + 1;
  await profileDao.update({ profileId }, { modelCount: newModelCount });

  // Send SQS message to import job queue
  try {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          importType: ModelSource.IMPORTED_PHYSICAL,
          modelId,
          profileId,
          s3Location,
          modelName,
        }),
      }),
    );
  } catch (error) {
    logger.error('Failed to send import job to SQS, rolling back', { modelId, profileId, error });
    // Roll back model, training, and model count. All fire independently.
    await Promise.allSettled([
      modelDao.delete({ modelId, profileId }),
      trainingDao.delete({ modelId }),
      profileDao.update({ profileId }, { modelCount: profileQuota.modelCount ?? 0 }),
    ]);
    throw error;
  }

  metricsLogger.logImportPhysicalModel();

  return { modelId } satisfies ImportPhysicalModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getImportPhysicalModelHandler(instrumentOperation(ImportPhysicalModelOperation)),
);
