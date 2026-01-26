// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  evaluationDao,
  modelDao,
  TEST_EVALUATION_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_MODEL_ITEM,
  trainingDao,
} from '@deepracer-indy/database';
import { BadRequestError, ModelStatus } from '@deepracer-indy/typescript-server-client';
import { metricsLogger, s3Helper } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeleteModelOperation } from '../deleteModel.js';

describe('DeleteModel operation', () => {
  it('should successfully delete model', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
    vi.spyOn(modelDao, 'update').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.DELETING });
    vi.spyOn(evaluationDao, 'list').mockResolvedValue({ data: [TEST_EVALUATION_ITEM], cursor: null });
    vi.spyOn(trainingDao, 'delete').mockResolvedValue({
      modelId: TEST_MODEL_ITEM.modelId,
    });
    vi.spyOn(modelDao, 'delete').mockResolvedValue({
      modelId: TEST_MODEL_ITEM.modelId,
      profileId: TEST_MODEL_ITEM.profileId,
    });
    vi.spyOn(evaluationDao, 'batchDelete').mockResolvedValue([]);
    vi.spyOn(s3Helper, 'deleteS3Location').mockResolvedValue();
    const metricsLoggerSpy = vi.spyOn(metricsLogger, 'logDeleteModel').mockImplementation(() => undefined);

    await DeleteModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(modelDao.load).toHaveBeenCalledTimes(1);
    expect(modelDao.update).toHaveBeenCalledTimes(1);
    expect(modelDao.delete).toHaveBeenCalledTimes(1);
    expect(evaluationDao.list).toHaveBeenCalledTimes(1);
    expect(evaluationDao.batchDelete).toHaveBeenCalledTimes(1);
    expect(trainingDao.delete).toHaveBeenCalledTimes(1);
    expect(metricsLoggerSpy).toHaveBeenCalledWith();
    expect(s3Helper.deleteS3Location).toHaveBeenNthCalledWith(1, TEST_MODEL_ITEM.assetS3Locations.modelRootS3Location);
    expect(s3Helper.deleteS3Location).toHaveBeenNthCalledWith(
      2,
      TEST_MODEL_ITEM.assetS3Locations.virtualModelArtifactS3Location,
    );
  });

  it('should throw error if model item does not exist', async () => {
    vi.spyOn(modelDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(
      DeleteModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should throw error if model is not in deletable state', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);

    return expect(
      DeleteModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(
      new BadRequestError({ message: 'This resource cannot be deleted at this time. Try again later.' }),
    );
  });

  it('should throw error if deleting S3 objects fails', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
    vi.spyOn(modelDao, 'update').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.DELETING });
    vi.spyOn(evaluationDao, 'list').mockResolvedValue({ data: [TEST_EVALUATION_ITEM], cursor: null });
    vi.spyOn(trainingDao, 'delete').mockResolvedValue({
      modelId: TEST_MODEL_ITEM.modelId,
    });
    vi.spyOn(modelDao, 'delete').mockResolvedValue({
      modelId: TEST_MODEL_ITEM.modelId,
      profileId: TEST_MODEL_ITEM.profileId,
    });
    vi.spyOn(evaluationDao, 'batchDelete').mockResolvedValue([]);
    vi.spyOn(s3Helper, 'deleteS3Location').mockRejectedValueOnce(new Error());

    return expect(
      DeleteModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new Error());
  });
});
