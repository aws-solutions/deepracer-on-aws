// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  evaluationDao,
  modelDao,
  trainingDao,
  ResourceId,
  TEST_EVALUATION_ITEM,
  TEST_MODEL_ITEM,
} from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { deleteModelData, ModelData } from '../deleteModelData.js';

vi.mock('@deepracer-indy/database');
vi.mock('@deepracer-indy/utils');

describe('deleteModelData', () => {
  const mockProfileId = 'test-profile-id' as ResourceId;
  const mockModelId = 'test-model-id' as ResourceId;
  const mockModelData: ModelData = {
    modelId: mockModelId,
    assetS3Locations: {
      modelRootS3Location: 's3://bucket/model-root',
      virtualModelArtifactS3Location: 's3://bucket/virtual-artifact',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(trainingDao, 'delete').mockResolvedValue({ modelId: mockModelId });
    vi.spyOn(evaluationDao, 'list').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(evaluationDao, 'batchDelete').mockResolvedValue([]);
    vi.spyOn(s3Helper, 'deleteS3Location').mockResolvedValue();
    vi.spyOn(modelDao, 'delete').mockResolvedValue({ modelId: mockModelId, profileId: mockProfileId });
    vi.spyOn(modelDao, 'update').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.ERROR });
    vi.mocked(logger.info).mockImplementation(vi.fn());
    vi.mocked(logger.error).mockImplementation(vi.fn());
  });

  it('should delete all model data successfully', async () => {
    await deleteModelData(mockProfileId, mockModelData);

    expect(trainingDao.delete).toHaveBeenCalledWith({ modelId: mockModelId });
    expect(evaluationDao.list).toHaveBeenCalledWith({ modelId: mockModelId });
    expect(evaluationDao.batchDelete).toHaveBeenCalledWith([]);
    expect(s3Helper.deleteS3Location).toHaveBeenCalledWith('s3://bucket/model-root');
    expect(s3Helper.deleteS3Location).toHaveBeenCalledWith('s3://bucket/virtual-artifact');
    expect(modelDao.delete).toHaveBeenCalledWith({ profileId: mockProfileId, modelId: mockModelId });
  });

  it('should handle evaluation jobs with pagination', async () => {
    const mockEvaluationJobs = [TEST_EVALUATION_ITEM, { ...TEST_EVALUATION_ITEM, evaluationId: 'eval2' as ResourceId }];
    vi.spyOn(evaluationDao, 'list')
      .mockResolvedValueOnce({ data: [mockEvaluationJobs[0]], cursor: 'cursor1' })
      .mockResolvedValueOnce({ data: [mockEvaluationJobs[1]], cursor: null });

    await deleteModelData(mockProfileId, mockModelData);

    expect(evaluationDao.list).toHaveBeenCalledTimes(2);
    expect(evaluationDao.list).toHaveBeenNthCalledWith(1, { modelId: mockModelId });
    expect(evaluationDao.list).toHaveBeenNthCalledWith(2, { modelId: mockModelId, cursor: 'cursor1' });
    expect(evaluationDao.batchDelete).toHaveBeenCalledWith(mockEvaluationJobs);
  });

  it('should skip virtual artifact deletion when not present', async () => {
    const modelDataWithoutVirtual: ModelData = {
      modelId: mockModelId,
      assetS3Locations: {
        modelRootS3Location: 's3://bucket/model-root',
      },
    };

    await deleteModelData(mockProfileId, modelDataWithoutVirtual);

    expect(s3Helper.deleteS3Location).toHaveBeenCalledTimes(1);
    expect(s3Helper.deleteS3Location).toHaveBeenCalledWith('s3://bucket/model-root');
  });

  it('should revert model status to ERROR on failure', async () => {
    const mockError = new Error('Deletion failed');
    vi.spyOn(trainingDao, 'delete').mockRejectedValue(mockError);

    await expect(deleteModelData(mockProfileId, mockModelData)).rejects.toThrow('Deletion failed');

    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: mockProfileId, modelId: mockModelId },
      { status: ModelStatus.ERROR },
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to delete model data, reverted status to ERROR for manual cleanup',
      {
        profileId: mockProfileId,
        modelId: mockModelId,
        error: mockError,
      },
    );
  });
});
