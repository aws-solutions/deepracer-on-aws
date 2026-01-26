// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, ResourceId } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { deleteModelData } from './deleteModelData.js';

export async function deleteModelsForProfile(profileId: ResourceId): Promise<void> {
  logger.info('Starting deletion of all models for profile', { profileId });

  // Get all models for the profile with pagination
  let cursor: string | null = null;
  const allModels = [];

  do {
    const result = await modelDao.list({ profileId, cursor });
    allModels.push(...result.data);
    cursor = result.cursor;
  } while (cursor);

  logger.info('Found models to delete', { profileId, modelCount: allModels.length });

  // Delete each model
  let deletedCount = 0;
  let failedCount = 0;

  for (const model of allModels) {
    try {
      if (model.status === ModelStatus.DELETING) {
        continue;
      }

      if (model.status === ModelStatus.READY || model.status === ModelStatus.ERROR) {
        await modelDao.update({ profileId, modelId: model.modelId }, { status: ModelStatus.DELETING });
      }

      await deleteModelData(profileId, model);

      deletedCount += 1;
    } catch (error) {
      failedCount += 1;
      logger.error('Failed to delete model', { modelId: model.modelId, error });
    }
  }

  logger.info('Completed deletion of models for profile', {
    profileId,
    deletedCount,
    failedCount,
    totalModels: allModels.length,
  });
}
