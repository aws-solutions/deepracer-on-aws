// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { evaluationDao, modelDao, trainingDao, ResourceId } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

export interface ModelData {
  modelId: ResourceId;
  assetS3Locations: {
    modelRootS3Location: string;
    virtualModelArtifactS3Location?: string;
  };
}

export async function deleteModelData(profileId: ResourceId, model: ModelData): Promise<void> {
  try {
    // Delete training job
    logger.info('Deleting the training job item');
    await trainingDao.delete({ modelId: model.modelId });
    logger.info('Deleted the training job item');

    // Delete evaluation jobs
    logger.info('Deleting the evaluation job items');
    const evaluationJobsList = await evaluationDao.list({ modelId: model.modelId });
    let cursor = evaluationJobsList.cursor;
    const evaluationJobs = evaluationJobsList.data;

    while (cursor) {
      const response = await evaluationDao.list({ modelId: model.modelId, cursor });
      evaluationJobs.push(...response.data);
      cursor = response.cursor;
    }

    await evaluationDao.batchDelete(evaluationJobs);
    logger.info('Deleted the evaluation job items');

    // Delete model in S3
    logger.info('Deleting the model item');
    await s3Helper.deleteS3Location(model.assetS3Locations.modelRootS3Location);
    if (model.assetS3Locations?.virtualModelArtifactS3Location) {
      await s3Helper.deleteS3Location(model.assetS3Locations.virtualModelArtifactS3Location);
    }
    await modelDao.delete({ profileId, modelId: model.modelId });
    logger.info('Deleted the model item');
  } catch (error) {
    // Revert model status on failure for manual cleanup
    await modelDao.update({ profileId, modelId: model.modelId }, { status: ModelStatus.ERROR });
    logger.error('Failed to delete model data, reverted status to ERROR for manual cleanup', {
      profileId,
      modelId: model.modelId,
      error,
    });
    throw error;
  }
}
