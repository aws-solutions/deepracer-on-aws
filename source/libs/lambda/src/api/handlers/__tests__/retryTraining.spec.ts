// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { modelDao, TEST_MODEL_ITEM, TEST_TRAINING_ITEM, trainingDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  InternalFailureError,
  JobStatus,
  ModelStatus,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { sqsClient } from '../../../utils/clients/sqsClient.js';
import { CapacityMessage } from '../../../workflow/constants/capacityMessages.js';
import { CapacityStatus, CapacityUnavailableReason } from '../../../workflow/types/capacityCheckResult.js';
import { sageMakerHelper } from '../../../workflow/utils/SageMakerHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { RetryTrainingOperation } from '../retryTraining.js';

/** A model/training pair in the only state that permits a retry. */
const WAITING_MODEL = { ...TEST_MODEL_ITEM, status: ModelStatus.WAITING_FOR_CAPACITY };
const WAITING_TRAINING = {
  ...TEST_TRAINING_ITEM,
  status: JobStatus.WAITING_FOR_CAPACITY,
  // A retryable job never reached SageMaker, so it has no job ARN.
  sageMakerJobArn: undefined,
};

const CONDITIONAL_CHECK_FAILED = Object.assign(new Error('wrapped'), {
  cause: { name: 'ConditionalCheckFailedException' },
});

describe('RetryTraining', () => {
  const mockSqsClient = mockClient(sqsClient);

  beforeEach(() => {
    mockSqsClient.reset();
    mockSqsClient.on(SendMessageCommand).resolves({});
    vi.spyOn(modelDao, 'transitionStatus').mockResolvedValue();
    vi.spyOn(trainingDao, 'transitionStatus').mockResolvedValue();
  });

  const mockWaitingRecords = () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(WAITING_MODEL);
    vi.spyOn(trainingDao, 'load').mockResolvedValue(WAITING_TRAINING);
  };

  const mockCapacity = (result: Awaited<ReturnType<typeof sageMakerHelper.checkTrainingCapacity>>) =>
    vi.spyOn(sageMakerHelper, 'checkTrainingCapacity').mockResolvedValue(result);

  it('should queue the job and send exactly one workflow message when capacity is available', async () => {
    mockWaitingRecords();
    mockCapacity({
      status: CapacityStatus.AVAILABLE,
      effectiveInstanceType: 'ml.c7i.4xlarge',
      requiredInstanceCount: 1,
    });

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).resolves.toEqual(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        status: ModelStatus.QUEUED,
        message: CapacityMessage.DISPATCHED,
      },
    );

    expect(mockSqsClient.commandCalls(SendMessageCommand)).toHaveLength(1);
    expect(modelDao.transitionStatus).toHaveBeenCalledWith(
      { modelId: TEST_MODEL_ITEM.modelId, profileId: TEST_OPERATION_CONTEXT.profileId },
      { from: ModelStatus.WAITING_FOR_CAPACITY, to: ModelStatus.QUEUED },
    );
    expect(trainingDao.transitionStatus).toHaveBeenCalledWith(
      { modelId: TEST_MODEL_ITEM.modelId },
      { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.QUEUED },
    );
  });

  it('should use a fresh deduplication ID so a retry is not swallowed by the FIFO dedup window', async () => {
    mockWaitingRecords();
    mockCapacity({
      status: CapacityStatus.AVAILABLE,
      effectiveInstanceType: 'ml.c7i.4xlarge',
      requiredInstanceCount: 1,
    });

    await RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    const [call] = mockSqsClient.commandCalls(SendMessageCommand);
    expect(call.args[0].input.MessageDeduplicationId).not.toBe(WAITING_TRAINING.name);
    expect(call.args[0].input.MessageDeduplicationId).toMatch(new RegExp(`^${WAITING_TRAINING.name}-.+`));
  });

  it('should stay waiting and send nothing when capacity is still unavailable', async () => {
    mockWaitingRecords();
    mockCapacity({
      status: CapacityStatus.UNAVAILABLE,
      effectiveInstanceType: 'ml.c7i.4xlarge',
      requiredInstanceCount: 1,
      reason: CapacityUnavailableReason.INSTANCE_TYPE_QUOTA,
    });

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).resolves.toEqual(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        status: ModelStatus.WAITING_FOR_CAPACITY,
        message: CapacityMessage.UNAVAILABLE,
      },
    );

    expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
  });

  it('should stay waiting with the unknown-capacity message when the quota check fails', async () => {
    mockWaitingRecords();
    mockCapacity({ status: CapacityStatus.UNKNOWN, error: new Error('AccessDenied') });

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).resolves.toEqual(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        status: ModelStatus.WAITING_FOR_CAPACITY,
        // Must not claim a specific quota is exhausted when capacity could not be verified.
        message: CapacityMessage.UNKNOWN,
      },
    );

    expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
  });

  it('should not send a duplicate message when a concurrent retry already won the transition', async () => {
    mockWaitingRecords();
    mockCapacity({
      status: CapacityStatus.AVAILABLE,
      effectiveInstanceType: 'ml.c7i.4xlarge',
      requiredInstanceCount: 1,
    });
    vi.spyOn(modelDao, 'transitionStatus').mockRejectedValue(CONDITIONAL_CHECK_FAILED);

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).resolves.toEqual(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        status: ModelStatus.QUEUED,
        message: CapacityMessage.DISPATCHED,
      },
    );

    expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
  });

  it('should roll back to waiting and fail when the workflow message cannot be sent', async () => {
    mockWaitingRecords();
    mockCapacity({
      status: CapacityStatus.AVAILABLE,
      effectiveInstanceType: 'ml.c7i.4xlarge',
      requiredInstanceCount: 1,
    });
    mockSqsClient.on(SendMessageCommand).rejects(new Error('SQS unavailable'));

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );

    expect(modelDao.transitionStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ from: ModelStatus.QUEUED, to: ModelStatus.WAITING_FOR_CAPACITY }),
    );
  });

  it.each([ModelStatus.READY, ModelStatus.ERROR, ModelStatus.DELETING])(
    'should reject a retry for a model in terminal status %s',
    async (status) => {
      vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status });
      vi.spyOn(trainingDao, 'load').mockResolvedValue(WAITING_TRAINING);

      await expect(
        RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
      ).rejects.toThrow(BadRequestError);
    },
  );

  it.each([ModelStatus.QUEUED, ModelStatus.TRAINING, ModelStatus.EVALUATING])(
    'should reject a retry for a model already in progress: %s',
    async (status) => {
      vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status });
      vi.spyOn(trainingDao, 'load').mockResolvedValue(WAITING_TRAINING);

      await expect(
        RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
      ).rejects.toThrow(ConflictError);
    },
  );

  it('should reject a retry when a SageMaker job already exists for the training job', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(WAITING_MODEL);
    // A persisted job ARN means retrying would create a second SageMaker job.
    vi.spyOn(trainingDao, 'load').mockResolvedValue(TEST_TRAINING_ITEM);

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      ConflictError,
    );

    expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
  });

  it('should reject a retry when the training job is no longer waiting', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(WAITING_MODEL);
    vi.spyOn(trainingDao, 'load').mockResolvedValue({
      ...WAITING_TRAINING,
      status: JobStatus.IN_PROGRESS,
    });

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      ConflictError,
    );
  });

  it('should surface NotFoundError for a model the caller does not own or that does not exist', async () => {
    const notFound = new NotFoundError({ message: 'Item not found' });
    vi.spyOn(modelDao, 'load').mockRejectedValue(notFound);
    vi.spyOn(trainingDao, 'load').mockRejectedValue(notFound);

    await expect(RetryTrainingOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
  });
});
