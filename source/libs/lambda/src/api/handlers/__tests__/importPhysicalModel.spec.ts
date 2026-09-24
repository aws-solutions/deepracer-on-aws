// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, profileDao, trainingDao, TEST_PROFILE_ID_1 } from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  JobStatus,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';

import { s3Client } from '../../../utils/clients/s3Client.js';
import { sqsClient } from '../../../utils/clients/sqsClient.js';
import { usageQuotaHelper } from '../../../utils/UsageQuotaHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ImportPhysicalModelOperation } from '../importPhysicalModel.js';

vi.mock('../../../utils/clients/s3Client.js', () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../../utils/clients/sqsClient.js', () => ({
  sqsClient: { send: vi.fn().mockResolvedValue({}) },
}));

const UPLOAD_BUCKET = 'test-upload-bucket';
const IMPORT_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/import-queue';

beforeAll(() => {
  process.env.UPLOAD_BUCKET_NAME = UPLOAD_BUCKET;
  process.env.IMPORT_MODEL_JOB_QUEUE_URL = IMPORT_QUEUE_URL;
});

afterAll(() => {
  delete process.env.UPLOAD_BUCKET_NAME;
  delete process.env.IMPORT_MODEL_JOB_QUEUE_URL;
});

const validInput = {
  s3Bucket: UPLOAD_BUCKET,
  s3Path: `uploads/physical-models/${TEST_PROFILE_ID_1}/my-model.tar.gz`,
  modelName: 'my-physical-model',
};

describe('ImportPhysicalModel operation', () => {
  beforeEach(() => {
    vi.spyOn(usageQuotaHelper, 'loadProfileComputeUsage').mockResolvedValue({
      computeMinutesQueued: 0,
      computeMinutesUsed: 0,
      maxTotalComputeMinutes: -1,
      modelCount: 3,
      maxModelCount: 10,
    });
    vi.spyOn(modelDao, 'create').mockResolvedValue({} as never);
    vi.spyOn(trainingDao, 'create').mockResolvedValue({} as never);
    vi.spyOn(profileDao, 'update').mockResolvedValue({} as never);
  });

  it('should return modelId on successful import', async () => {
    const logImportSpy = vi.spyOn(metricsLogger, 'logImportPhysicalModel').mockImplementation(() => undefined);

    const output = await ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(output.modelId).toBeDefined();
    expect(modelDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-physical-model',
        status: 'IMPORTING',
        modelSource: 'IMPORTED_PHYSICAL',
      }),
    );
    expect(sqsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: IMPORT_QUEUE_URL,
        }),
      }),
    );
    expect(logImportSpy).toHaveBeenCalledWith();
  });

  it('should increment modelCount on the profile after successful import', async () => {
    const output = await ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(output.modelId).toBeDefined();
    expect(profileDao.update).toHaveBeenCalledWith({ profileId: TEST_PROFILE_ID_1 }, { modelCount: 4 });
  });

  it('should throw NotAuthorizedError when S3 path does not match caller profileId', async () => {
    const input = {
      ...validInput,
      s3Path: 'uploads/physical-models/other-user/model.tar.gz',
    };

    await expect(ImportPhysicalModelOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('should throw BadRequestError when upload does not exist', async () => {
    const notFoundError = new Error('Not found');
    Object.defineProperty(notFoundError, 'name', { value: 'NotFound' });
    vi.mocked(s3Client.send).mockRejectedValueOnce(notFoundError);

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when model quota is exceeded', async () => {
    vi.spyOn(usageQuotaHelper, 'loadProfileComputeUsage').mockResolvedValue({
      computeMinutesQueued: 0,
      computeMinutesUsed: 0,
      maxTotalComputeMinutes: -1,
      modelCount: 10,
      maxModelCount: 10,
    });

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should allow import when maxModelCount is -1 (unlimited)', async () => {
    vi.spyOn(usageQuotaHelper, 'loadProfileComputeUsage').mockResolvedValue({
      computeMinutesQueued: 0,
      computeMinutesUsed: 0,
      maxTotalComputeMinutes: -1,
      modelCount: 100,
      maxModelCount: -1,
    });

    const output = await ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT);
    expect(output.modelId).toBeDefined();
  });

  it('should allow import when maxModelCount is undefined (no limit set)', async () => {
    vi.spyOn(usageQuotaHelper, 'loadProfileComputeUsage').mockResolvedValue({
      computeMinutesQueued: 0,
      computeMinutesUsed: 0,
      maxTotalComputeMinutes: -1,
      modelCount: 100,
      maxModelCount: undefined,
    });

    const output = await ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT);
    expect(output.modelId).toBeDefined();
  });

  it('should throw NotAuthorizedError when s3Bucket does not match configured bucket', async () => {
    const input = { ...validInput, s3Bucket: 'attacker-bucket' };

    await expect(ImportPhysicalModelOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('should re-throw unexpected S3 errors', async () => {
    const s3Error = new Error('Internal server error');
    Object.defineProperty(s3Error, 'name', { value: 'InternalError' });
    vi.mocked(s3Client.send).mockRejectedValueOnce(s3Error);

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Internal server error',
    );
  });

  it('should throw when IMPORT_MODEL_JOB_QUEUE_URL is not configured', async () => {
    delete process.env.IMPORT_MODEL_JOB_QUEUE_URL;

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );

    process.env.IMPORT_MODEL_JOB_QUEUE_URL = IMPORT_QUEUE_URL;
  });

  it('should throw InternalFailureError when UPLOAD_BUCKET_NAME is not configured', async () => {
    delete process.env.UPLOAD_BUCKET_NAME;

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );

    process.env.UPLOAD_BUCKET_NAME = UPLOAD_BUCKET;
  });

  it('should delete model and training records if SQS send fails (rollback)', async () => {
    vi.mocked(sqsClient.send).mockRejectedValueOnce(new Error('SQS SendMessage failed'));
    vi.spyOn(modelDao, 'delete').mockResolvedValue(undefined as never);
    vi.spyOn(trainingDao, 'delete').mockResolvedValue(undefined as never);

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'SQS SendMessage failed',
    );

    expect(modelDao.create).toHaveBeenCalled();
    expect(trainingDao.create).toHaveBeenCalled();
    expect(modelDao.delete).toHaveBeenCalledWith(expect.objectContaining({ profileId: TEST_PROFILE_ID_1 }));
    expect(trainingDao.delete).toHaveBeenCalled();
  });

  it('should revert modelCount when SQS send fails', async () => {
    vi.mocked(sqsClient.send).mockRejectedValueOnce(new Error('SQS SendMessage failed'));
    vi.spyOn(modelDao, 'delete').mockResolvedValue(undefined as never);
    vi.spyOn(trainingDao, 'delete').mockResolvedValue(undefined as never);

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'SQS SendMessage failed',
    );

    // modelCount was incremented to 4 before SQS, then reverted to 3 in rollback
    expect(profileDao.update).toHaveBeenCalledTimes(2);
    expect(profileDao.update).toHaveBeenNthCalledWith(1, { profileId: TEST_PROFILE_ID_1 }, { modelCount: 4 });
    expect(profileDao.update).toHaveBeenNthCalledWith(2, { profileId: TEST_PROFILE_ID_1 }, { modelCount: 3 });
  });

  it('should propagate original SQS error even if rollback delete fails', async () => {
    vi.mocked(sqsClient.send).mockRejectedValueOnce(new Error('SQS SendMessage failed'));
    vi.spyOn(modelDao, 'delete').mockRejectedValueOnce(new Error('Delete failed'));

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'SQS SendMessage failed',
    );
  });

  it('should delete model record if training create fails (compensation)', async () => {
    vi.spyOn(trainingDao, 'create').mockRejectedValueOnce(new Error('DDB write failed'));
    vi.spyOn(modelDao, 'delete').mockResolvedValue(undefined as never);

    await expect(ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow('DDB write failed');

    expect(modelDao.create).toHaveBeenCalled();
    expect(modelDao.delete).toHaveBeenCalledWith(expect.objectContaining({ profileId: TEST_PROFILE_ID_1 }));
  });

  it('should create training record after model record', async () => {
    const output = await ImportPhysicalModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(output.modelId).toBeDefined();
    expect(trainingDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: output.modelId,
        profileId: TEST_PROFILE_ID_1,
        raceType: 'TIME_TRIAL',
        status: JobStatus.COMPLETED,
        terminationConditions: { maxTimeInMinutes: 0 },
        trackConfig: { trackId: 'reInvent2019_wide', trackDirection: 'CLOCKWISE' },
      }),
    );
  });
});
