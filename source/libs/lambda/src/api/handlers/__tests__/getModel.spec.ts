// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  modelDao,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_MODEL_ITEM,
  TEST_TRAINING_ITEM,
  TEST_TRAINING_ITEM_OA,
  trainingDao,
} from '@deepracer-indy/database';
import { s3Helper } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetModelOperation } from '../getModel.js';

describe('GetModel operation', () => {
  it('should correctly convert modelItem to response', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(trainingDao, 'load').mockResolvedValue(TEST_TRAINING_ITEM_OA);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));

    const output = await GetModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output.model).toEqual({
      carCustomization: TEST_MODEL_ITEM.carCustomization,
      createdAt: new Date(TEST_MODEL_ITEM.createdAt),
      description: TEST_MODEL_ITEM.description,
      metadata: TEST_MODEL_ITEM.metadata,
      modelId: TEST_MODEL_ITEM.modelId,
      name: TEST_MODEL_ITEM.name,
      fileSizeInBytes: TEST_MODEL_ITEM.fileSizeInBytes,
      status: TEST_MODEL_ITEM.status,
      importErrorMessage: TEST_MODEL_ITEM.importErrorMessage,
      trainingConfig: {
        maxTimeInMinutes: TEST_TRAINING_ITEM_OA.terminationConditions.maxTimeInMinutes,
        objectAvoidanceConfig: TEST_TRAINING_ITEM_OA.objectAvoidanceConfig,
        raceType: TEST_TRAINING_ITEM_OA.raceType,
        trackConfig: TEST_TRAINING_ITEM_OA.trackConfig,
      },
      trainingStatus: TEST_TRAINING_ITEM_OA.status,
      trainingMetricsUrl: TEST_TRAINING_ITEM_OA.assetS3Locations.metricsS3Location,
      trainingVideoStreamUrl: TEST_TRAINING_ITEM_OA.videoStreamUrl,
    });
  });

  it('should fail if model item does not exist', async () => {
    expect.assertions(1);
    vi.spyOn(modelDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);
    vi.spyOn(trainingDao, 'load').mockResolvedValueOnce(TEST_TRAINING_ITEM);

    return expect(
      GetModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should fail if training item does not exist', async () => {
    expect.assertions(1);
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(TEST_MODEL_ITEM);
    vi.spyOn(trainingDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(
      GetModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
