// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceId, modelDao } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';
import type { Context, Handler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { importHelper } from '../utils/ImportHelper.js';

/**
 * Request payload for importing a model from S3 required for model creation
 * @property {string} s3Location - S3 URI where model files are stored
 * @property {ResourceId} profileId - Identifier for the user's profile
 * @property {ResourceId} modelId - Identifier for the model being imported
 * @property {string} [modelDescription] - Optional description for the model
 */
interface ImportModelRequest {
  s3Location: string;
  profileId: ResourceId;
  modelId: ResourceId;
  modelDescription?: string;
  modelName: string;
}

/**
 * Lambda handler for importing model assets from S3
 * Copies model files to managed storage and updates model with reward function
 * @param event - Import model request containing S3 location and model details
 * @param context - Lambda execution context
 * @returns Success response
 */
export async function handler(event: ImportModelRequest, context: Context): Promise<{ success: true }> {
  logger.info(`Event: ${JSON.stringify(event)}`, { requestId: context.awsRequestId });
  const { s3Location, profileId, modelId } = event;

  try {
    const { rewardFunction } = await importHelper.parseImportedFiles(s3Location);

    // Typecast to any is required due to an issue with ElectroDB's types
    await modelDao.update({ modelId, profileId }, { ['metadata.rewardFunction' as any]: rewardFunction }); // eslint-disable-line @typescript-eslint/no-explicit-any

    await importHelper.copyModelFiles(s3Location, profileId, modelId);

    logger.info('Model assets imported successfully with reward function update', {
      s3Location,
      profileId,
      modelId,
      requestId: context.awsRequestId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error importing model assets', {
      error,
      s3Location,
      profileId,
      modelId,
      requestId: context.awsRequestId,
    });
    throw error;
  }
}

export const lambdaHandler: Handler<ImportModelRequest, { success: true }> = instrumentHandler(handler);
