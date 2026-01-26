// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  modelDao,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_MODEL_ITEMS,
  TEST_TRAINING_ITEMS,
  trainingDao,
} from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListModelsOperation } from '../listModels.js';

describe('ListModels operation', () => {
  beforeEach(() => {
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));
  });

  it('should return successful response', async () => {
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: TEST_MODEL_ITEMS, cursor: null });
    vi.spyOn(trainingDao, 'batchGet').mockResolvedValue(TEST_TRAINING_ITEMS);

    const output = await ListModelsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.models).toBeDefined();
    expect(output.models).toHaveLength(TEST_MODEL_ITEMS.length);
    expect(output.token).toBeUndefined();
    output.models.forEach((model, i) => {
      expect(model).toEqual({
        carCustomization: TEST_MODEL_ITEMS[i].carCustomization,
        createdAt: new Date(TEST_MODEL_ITEMS[i].createdAt),
        description: TEST_MODEL_ITEMS[i].description,
        metadata: TEST_MODEL_ITEMS[i].metadata,
        modelId: TEST_MODEL_ITEMS[i].modelId,
        name: TEST_MODEL_ITEMS[i].name,
        fileSizeInBytes: TEST_MODEL_ITEMS[i].fileSizeInBytes,
        importErrorMessage: TEST_MODEL_ITEMS[i].importErrorMessage,
        status: TEST_MODEL_ITEMS[i].status,
        trainingConfig: {
          maxTimeInMinutes: TEST_TRAINING_ITEMS[i].terminationConditions.maxTimeInMinutes,
          objectAvoidanceConfig: TEST_TRAINING_ITEMS[i].objectAvoidanceConfig,
          raceType: TEST_TRAINING_ITEMS[i].raceType,
          trackConfig: TEST_TRAINING_ITEMS[i].trackConfig,
        },
        trainingStatus: TEST_TRAINING_ITEMS[i].status,
        trainingMetricsUrl: TEST_TRAINING_ITEMS[i].assetS3Locations.metricsS3Location,
        trainingVideoStreamUrl: TEST_TRAINING_ITEMS[i].videoStreamUrl,
      });
    });
  });

  it('should return successful response and confirm next tokens are set', async () => {
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: TEST_MODEL_ITEMS, cursor: 'nextToken' });
    vi.spyOn(trainingDao, 'batchGet').mockResolvedValue(TEST_TRAINING_ITEMS);

    const output = await ListModelsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.models).toBeDefined();
    expect(output.models).toHaveLength(TEST_MODEL_ITEMS.length);
    expect(output.token).toBe('nextToken');
    output.models.forEach((model, i) => {
      expect(model).toEqual({
        carCustomization: TEST_MODEL_ITEMS[i].carCustomization,
        createdAt: new Date(TEST_MODEL_ITEMS[i].createdAt),
        description: TEST_MODEL_ITEMS[i].description,
        metadata: TEST_MODEL_ITEMS[i].metadata,
        modelId: TEST_MODEL_ITEMS[i].modelId,
        name: TEST_MODEL_ITEMS[i].name,
        fileSizeInBytes: TEST_MODEL_ITEMS[i].fileSizeInBytes,
        importErrorMessage: TEST_MODEL_ITEMS[i].importErrorMessage,
        status: TEST_MODEL_ITEMS[i].status,
        trainingConfig: {
          maxTimeInMinutes: TEST_TRAINING_ITEMS[i].terminationConditions.maxTimeInMinutes,
          objectAvoidanceConfig: TEST_TRAINING_ITEMS[i].objectAvoidanceConfig,
          raceType: TEST_TRAINING_ITEMS[i].raceType,
          trackConfig: TEST_TRAINING_ITEMS[i].trackConfig,
        },
        trainingStatus: TEST_TRAINING_ITEMS[i].status,
        trainingMetricsUrl: TEST_TRAINING_ITEMS[i].assetS3Locations.metricsS3Location,
        trainingVideoStreamUrl: TEST_TRAINING_ITEMS[i].videoStreamUrl,
      });
    });
  });

  it('should be empty response if no models exist', async () => {
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(trainingDao, 'batchGet').mockResolvedValue(TEST_TRAINING_ITEMS);

    const output = await ListModelsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.models).toHaveLength(0);
    expect(output.token).toBeUndefined();
  });

  it('response should throw error if no training job is found', async () => {
    expect.assertions(1);
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: TEST_MODEL_ITEMS, cursor: null });
    vi.spyOn(trainingDao, 'batchGet').mockResolvedValue([]);

    return expect(ListModelsOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new InternalFailureError({ message: 'Training item not found.' }),
    );
  });

  it('should fail with error if training batchGet call errors', async () => {
    expect.assertions(1);
    vi.spyOn(modelDao, 'list').mockResolvedValue({ data: TEST_MODEL_ITEMS, cursor: null });
    vi.spyOn(trainingDao, 'batchGet').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(ListModelsOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
