// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, ResourceId, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { deleteModelData } from '../deleteModelData.js';
import { deleteModelsForProfile } from '../deleteModelsForProfile.js';

vi.mock('@deepracer-indy/database');
vi.mock('@deepracer-indy/utils');
vi.mock('../deleteModelData.js');

describe('deleteModelsForProfile', () => {
  const mockProfileId = 'test-profile-id' as ResourceId;
  const mockModels = [
    { ...TEST_MODEL_ITEM, modelId: 'model1' as ResourceId, status: ModelStatus.READY },
    { ...TEST_MODEL_ITEM, modelId: 'model2' as ResourceId, status: ModelStatus.ERROR },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(modelDao, 'update').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.DELETING });
    vi.mocked(deleteModelData).mockResolvedValue();
    vi.mocked(logger.info).mockImplementation(vi.fn());
    vi.mocked(logger.error).mockImplementation(vi.fn());
  });

  it('should delete all models for profile successfully', async () => {
    vi.mocked(modelDao.list).mockResolvedValue({ data: mockModels, cursor: null });

    await deleteModelsForProfile(mockProfileId);

    expect(modelDao.list).toHaveBeenCalledWith({ profileId: mockProfileId, cursor: null });
    expect(modelDao.update).toHaveBeenCalledTimes(2);
    expect(deleteModelData).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('Completed deletion of models for profile', {
      profileId: mockProfileId,
      deletedCount: 2,
      failedCount: 0,
      totalModels: 2,
    });
  });

  it('should handle pagination when listing models', async () => {
    vi.spyOn(modelDao, 'list')
      .mockResolvedValueOnce({ data: [mockModels[0]], cursor: 'cursor1' })
      .mockResolvedValueOnce({ data: [mockModels[1]], cursor: null });

    await deleteModelsForProfile(mockProfileId);

    expect(modelDao.list).toHaveBeenCalledTimes(2);
    expect(modelDao.list).toHaveBeenNthCalledWith(1, { profileId: mockProfileId, cursor: null });
    expect(modelDao.list).toHaveBeenNthCalledWith(2, { profileId: mockProfileId, cursor: 'cursor1' });
  });

  it('should skip models already in DELETING status', async () => {
    const deletingModel = { ...mockModels[0], status: ModelStatus.DELETING };
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: [deletingModel], cursor: null });

    await deleteModelsForProfile(mockProfileId);

    expect(modelDao.update).not.toHaveBeenCalled();
    expect(deleteModelData).not.toHaveBeenCalled();
  });

  it('should continue processing other models when one fails', async () => {
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: mockModels, cursor: null });
    vi.mocked(deleteModelData).mockRejectedValueOnce(new Error('Delete failed')).mockResolvedValueOnce();

    await deleteModelsForProfile(mockProfileId);

    expect(deleteModelData).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Failed to delete model', {
      modelId: 'model1',
      error: expect.any(Error),
    });
    expect(logger.info).toHaveBeenCalledWith('Completed deletion of models for profile', {
      profileId: mockProfileId,
      deletedCount: 1,
      failedCount: 1,
      totalModels: 2,
    });
  });
});
