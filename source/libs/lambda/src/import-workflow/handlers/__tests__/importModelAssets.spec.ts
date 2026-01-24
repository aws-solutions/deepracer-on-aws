// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, ResourceId, TEST_MODEL_ITEM } from '@deepracer-indy/database';

import {
  mockContextConstants,
  mockRewardFunction,
  testConstants,
  mockTrainingParams,
  mockModelMetadata,
  mockHyperparameters,
} from '../../constants/testConstants.js';
import { importHelper } from '../../utils/ImportHelper.js';
import { handler } from '../importModelAssets.js';

const mockS3SourceLocation = `s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}`;
const mockProfileId = testConstants.ids.profile;

vi.mock('@deepracer-indy/database');
vi.mock('#import-workflow/utils/ImportHelper.js');

describe('Import Model Assets Handler', () => {
  const mockContext = {
    ...mockContextConstants,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };
  const mockModelId = 'test-model-id' as ResourceId;
  const mockEvent = {
    s3Location: mockS3SourceLocation,
    profileId: mockProfileId as ResourceId,
    modelId: mockModelId,
    modelName: 'Test Model',
    modelDescription: 'Test Description',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(importHelper.parseImportedFiles).mockResolvedValue({
      rewardFunction: mockRewardFunction,
      trainingParams: mockTrainingParams,
      modelMetadata: mockModelMetadata,
      hyperparameters: mockHyperparameters,
    });
    vi.mocked(importHelper.copyModelFiles).mockResolvedValue();
    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);
  });

  it('should successfully import model assets', async () => {
    const result = await handler(mockEvent, mockContext);

    expect(result).toEqual({ success: true });
    expect(importHelper.parseImportedFiles).toHaveBeenCalledWith(mockS3SourceLocation);
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { 'metadata.rewardFunction': mockRewardFunction },
    );
    expect(importHelper.copyModelFiles).toHaveBeenCalledWith(mockS3SourceLocation, mockProfileId, mockModelId);
  });

  it('should handle parsing files successfully', async () => {
    await handler(mockEvent, mockContext);

    expect(importHelper.parseImportedFiles).toHaveBeenCalledWith(mockS3SourceLocation);
    expect(modelDao.update).toHaveBeenCalled();
    expect(importHelper.copyModelFiles).toHaveBeenCalled();
  });

  it('should update model with reward function', async () => {
    await handler(mockEvent, mockContext);

    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { 'metadata.rewardFunction': mockRewardFunction },
    );
  });

  it('should copy model files to correct location', async () => {
    await handler(mockEvent, mockContext);

    expect(importHelper.copyModelFiles).toHaveBeenCalledWith(mockS3SourceLocation, mockProfileId, mockModelId);
  });

  it('should return correct response structure', async () => {
    const result = await handler(mockEvent, mockContext);

    expect(result).toEqual({ success: true });
  });

  it('should handle missing model description', async () => {
    const eventWithoutDescription = {
      ...mockEvent,
      modelDescription: undefined,
    };

    const result = await handler(eventWithoutDescription, mockContext);

    expect(result).toEqual({ success: true });
    expect(modelDao.update).toHaveBeenCalled();
  });

  it('should handle model update error', async () => {
    const updateError = new Error('Database update failed');
    vi.mocked(modelDao.update).mockRejectedValue(updateError);

    await expect(handler(mockEvent, mockContext)).rejects.toThrow('Database update failed');
  });

  it('should handle file copy error', async () => {
    const copyError = new Error('Failed to copy files');
    vi.mocked(importHelper.copyModelFiles).mockRejectedValue(copyError);

    await expect(handler(mockEvent, mockContext)).rejects.toThrow('Failed to copy files');
  });

  it('should handle successful import', async () => {
    const result = await handler(mockEvent, mockContext);

    expect(result).toEqual({ success: true });
    expect(importHelper.parseImportedFiles).toHaveBeenCalledWith(mockS3SourceLocation);
    expect(modelDao.update).toHaveBeenCalled();
    expect(importHelper.copyModelFiles).toHaveBeenCalled();
  });

  it('should handle errors during import', async () => {
    const error = new Error('Import failed');
    vi.mocked(importHelper.parseImportedFiles).mockRejectedValue(error);

    await expect(handler(mockEvent, mockContext)).rejects.toThrow('Import failed');
  });
});
