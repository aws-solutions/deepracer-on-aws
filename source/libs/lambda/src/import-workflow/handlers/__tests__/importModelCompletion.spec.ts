// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, ResourceId, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import type { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../importModelCompletion.js';

vi.mock('@deepracer-indy/database');
vi.mock('@deepracer-indy/utils');

describe('ImportModelValidation Handler', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
  } as Context;

  const mockModelId = 'test-model-id' as ResourceId;
  const mockProfileId = 'test-profile-id' as ResourceId;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete successfully when no validation errors', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
        validationResult: { Payload: { statusCode: 200 } },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    const result = await handler(event, mockContext);

    expect(result).toEqual({ success: true });
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.READY },
    );
  });

  it('should fail when reward validation has errors', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: {
          validationErrors: [{ message: 'ValueError: too many values to unpack (expected 3)' }],
        },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow(
      'Reward Function Validation ValueError: too many values to unpack (expected 3)',
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage: 'Reward Function Validation ValueError: too many values to unpack (expected 3)',
      },
    );
  });

  it('should fail when model validation has statusCode 500', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        validationResult: { Payload: { statusCode: 500 } },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.ERROR, importErrorMessage: 'Model validation failed' },
    );
  });

  it('should fail when model validation body is not valid', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'error message' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.ERROR, importErrorMessage: 'Model validation failed' },
    );
  });

  it('should handle model validation with specific error message', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'invalid' },
        validationResult: {
          Payload: {
            statusCode: 500,
            body: "\"{'simapp_exception': {'message': 'No checkpoint files'}}\"",
          },
        },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed: No checkpoint files');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage: 'Model validation failed: No checkpoint files',
      },
    );
  });

  it('should fail when modelId is missing', async () => {
    const event = {
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    await expect(handler(event, mockContext)).rejects.toThrow('Missing Model Identifier');
    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should fail when profileId is missing', async () => {
    const event = {
      modelId: mockModelId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    await expect(handler(event, mockContext)).rejects.toThrow('Missing Profile Identifier');
    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should fail when step error is present', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      Error: 'Step function error',
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Step function error');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while importing a model. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should handle database update error during completion', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    const dbError = new Error('Database error');
    vi.mocked(modelDao.update).mockRejectedValue(dbError);

    await expect(handler(event, mockContext)).rejects.toThrow('Database error');
    expect(modelDao.update).toHaveBeenCalledTimes(2);
  });

  it('should handle database update error when setting ERROR status', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
      },
    };
    const dbError = new Error('Database update failed');
    vi.mocked(modelDao.update).mockRejectedValue(dbError);

    await expect(handler(event, mockContext)).rejects.toThrow('Database update failed');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while importing a model. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should throw error when both modelId is missing', async () => {
    const event = {
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    await expect(handler(event, mockContext)).rejects.toThrow('Missing Model Identifier');
    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should handle undefined validation body as valid', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: undefined },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    const result = await handler(event, mockContext);

    expect(result).toEqual({ success: true });
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.READY },
    );
  });

  it('should handle error in catch block when updating to ERROR status fails', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    const error = new Error('Update failed');
    vi.mocked(modelDao.update).mockRejectedValueOnce(error).mockRejectedValueOnce(error);

    await expect(handler(event, mockContext)).rejects.toThrow('Update failed');
    expect(modelDao.update).toHaveBeenCalledTimes(2);
    expect(modelDao.update).toHaveBeenNthCalledWith(
      1,
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.READY },
    );
    expect(modelDao.update).toHaveBeenNthCalledWith(
      2,
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while importing a model. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should attempt fallback ERROR status update when READY update fails', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    const readyUpdateError = new Error('Failed to set READY status');
    vi.mocked(modelDao.update).mockRejectedValueOnce(readyUpdateError).mockResolvedValueOnce(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Failed to set READY status');
    expect(modelDao.update).toHaveBeenCalledTimes(2);
    expect(modelDao.update).toHaveBeenNthCalledWith(
      1,
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.READY },
    );
    expect(modelDao.update).toHaveBeenNthCalledWith(
      2,
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while importing a model. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should handle undefined validation data', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    const result = await handler(event, mockContext);

    expect(result).toEqual({ success: true });
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.READY },
    );
  });

  it('should handle multiple reward validation errors', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: {
          validationErrors: [
            { message: 'Error 1: Invalid syntax' },
            { message: 'Error 2: Missing variable' },
            { message: 'Error 3: Type mismatch' },
          ],
        },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow(
      'Reward Function Validation Error 1: Invalid syntax, Error 2: Missing variable, Error 3: Type mismatch',
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Reward Function Validation Error 1: Invalid syntax, Error 2: Missing variable, Error 3: Type mismatch',
      },
    );
  });

  it('should handle reward validation errors with empty messages', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: {
          validationErrors: [
            { message: 'UnknownError: First error message' },
            { message: '' },
            { message: undefined },
            {},
          ],
        },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow(
      'Reward Function Validation UnknownError: First error message',
    );
  });

  it('should handle reward validation with no valid error messages', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: {
          validationErrors: [{ message: '' }, { message: undefined }, {}],
        },
        parsedModelValidation: { validationBody: 'invalid' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);
    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage: 'Model validation failed',
      },
    );
  });

  it('should handle model validation with JSON object error format', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'invalid' },
        validationResult: {
          Payload: {
            statusCode: 500,
            body: JSON.stringify({ simapp_exception: { message: 'Model checkpoint corrupted' } }),
          },
        },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed: Model checkpoint corrupted');
  });

  it('should handle model validation with malformed error body', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'invalid' },
        validationResult: {
          Payload: {
            statusCode: 500,
            body: 'invalid-json-string',
          },
        },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    // JSON.parse() throws SyntaxError for malformed JSON, which gets caught by outer catch block
    await expect(handler(event, mockContext)).rejects.toThrow('Unexpected token');
    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should handle model validation with string that does not contain simapp_exception', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'invalid' },
        validationResult: {
          Payload: {
            statusCode: 500,
            body: '"Some generic error message without expected format"',
          },
        },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed');
  });

  it('should handle both reward and model validation errors (reward takes precedence)', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: {
          validationErrors: [{ message: 'Internal Server Error: Unable to parse' }],
        },
        parsedModelValidation: { validationBody: 'invalid' },
        validationResult: {
          Payload: {
            statusCode: 500,
            body: JSON.stringify({ simapp_exception: { message: 'Model error' } }),
          },
        },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow(
      'Reward Function Validation Internal Server Error: Unable to parse',
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage: 'Reward Function Validation Internal Server Error: Unable to parse',
      },
    );
  });

  it('should handle model validation statusCode 0 as error', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        validationResult: { Payload: { statusCode: 0 } },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Model validation failed');
  });

  it('should handle model validation with undefined statusCode and undefined validationBody', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: {},
        validationResult: { Payload: {} },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    const result = await handler(event, mockContext);
    expect(result).toEqual({ success: true });
  });

  it('should handle step error with cause information', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      Error: 'Lambda timeout error',
      Cause: 'Task timed out after 900.00 seconds',
      allValidationData: {
        parsedRewardValidation: { validationErrors: [] },
        parsedModelValidation: { validationBody: 'valid' },
      },
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    await expect(handler(event, mockContext)).rejects.toThrow('Lambda timeout error');
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while importing a model. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should handle case where modelId and profileId are present but no validation data', async () => {
    const event = {
      modelId: mockModelId,
      profileId: mockProfileId,
      allValidationData: undefined,
    };

    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);

    const result = await handler(event, mockContext);

    expect(result).toEqual({ success: true });
    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      { status: ModelStatus.READY },
    );
  });
});
