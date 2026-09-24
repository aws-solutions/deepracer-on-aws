// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { modelDao, TEST_MODEL_ITEM, TEST_TRAINING_ITEM, trainingDao } from '@deepracer-indy/database';
import { InternalFailureError, JobStatus, ModelStatus } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { sqsClient } from '../../../utils/clients/sqsClient.js';
import { CapacityMessage } from '../../../workflow/constants/capacityMessages.js';
import { CapacityStatus, CapacityUnavailableReason } from '../../../workflow/types/capacityCheckResult.js';
import { sageMakerHelper } from '../../../workflow/utils/SageMakerHelper.js';
import { trainingDispatchHelper } from '../TrainingDispatchHelper.js';

// A conditional-check-failure shaped exactly as isConditionalCheckFailure detects (wrapped by ElectroDB).
const CONDITIONAL_CHECK_FAILED = Object.assign(new Error('wrapped'), {
  cause: { name: 'ConditionalCheckFailedException' },
});

const TARGET = {
  modelId: TEST_MODEL_ITEM.modelId,
  profileId: TEST_MODEL_ITEM.profileId,
  jobName: TEST_TRAINING_ITEM.name as typeof TEST_TRAINING_ITEM.name,
};

describe('TrainingDispatchHelper', () => {
  const mockSqsClient = mockClient(sqsClient);

  beforeEach(() => {
    mockSqsClient.reset();
    mockSqsClient.on(SendMessageCommand).resolves({});
    vi.spyOn(modelDao, 'transitionStatus').mockResolvedValue();
    vi.spyOn(trainingDao, 'transitionStatus').mockResolvedValue();
  });

  const mockCapacity = (result: Awaited<ReturnType<typeof sageMakerHelper.checkTrainingCapacity>>) =>
    vi.spyOn(sageMakerHelper, 'checkTrainingCapacity').mockResolvedValue(result);

  describe('capacity UNAVAILABLE', () => {
    it('persists the UNAVAILABLE message on both records, sends no SQS message, returns WAITING_FOR_CAPACITY', async () => {
      mockCapacity({
        status: CapacityStatus.UNAVAILABLE,
        effectiveInstanceType: 'ml.c7i.4xlarge',
        requiredInstanceCount: 1,
        reason: CapacityUnavailableReason.TOTAL_INSTANCE_QUOTA,
      });

      const result = await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      expect(result).toEqual({ status: ModelStatus.WAITING_FOR_CAPACITY, message: CapacityMessage.UNAVAILABLE });
      expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
      expect(modelDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId, profileId: TARGET.profileId },
        {
          from: ModelStatus.WAITING_FOR_CAPACITY,
          to: ModelStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.UNAVAILABLE,
        },
      );
      expect(trainingDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId },
        {
          from: JobStatus.WAITING_FOR_CAPACITY,
          to: JobStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.UNAVAILABLE,
        },
      );
    });

    it('does not throw when persisting the waiting message fails (best-effort only)', async () => {
      mockCapacity({
        status: CapacityStatus.UNAVAILABLE,
        effectiveInstanceType: 'ml.c7i.4xlarge',
        requiredInstanceCount: 1,
        reason: CapacityUnavailableReason.INSTANCE_TYPE_QUOTA,
      });
      vi.spyOn(modelDao, 'transitionStatus').mockRejectedValue(new Error('DynamoDB write failed'));

      await expect(trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET)).resolves.toEqual({
        status: ModelStatus.WAITING_FOR_CAPACITY,
        message: CapacityMessage.UNAVAILABLE,
      });

      expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
    });
  });

  describe('capacity UNKNOWN', () => {
    it('persists the UNKNOWN message on both records, sends no SQS message, returns WAITING_FOR_CAPACITY', async () => {
      mockCapacity({ status: CapacityStatus.UNKNOWN, error: new Error('AccessDenied') });

      const result = await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      expect(result).toEqual({ status: ModelStatus.WAITING_FOR_CAPACITY, message: CapacityMessage.UNKNOWN });
      expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
      expect(modelDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId, profileId: TARGET.profileId },
        {
          from: ModelStatus.WAITING_FOR_CAPACITY,
          to: ModelStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.UNKNOWN,
        },
      );
      expect(trainingDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId },
        {
          from: JobStatus.WAITING_FOR_CAPACITY,
          to: JobStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.UNKNOWN,
        },
      );
    });
  });

  describe('capacity AVAILABLE', () => {
    beforeEach(() => {
      mockCapacity({
        status: CapacityStatus.AVAILABLE,
        effectiveInstanceType: 'ml.c7i.4xlarge',
        requiredInstanceCount: 1,
      });
    });

    it('wins the transition: sends exactly one SQS message and returns QUEUED', async () => {
      const result = await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      expect(result).toEqual({ status: ModelStatus.QUEUED, message: CapacityMessage.DISPATCHED });
      expect(mockSqsClient.commandCalls(SendMessageCommand)).toHaveLength(1);
    });

    it('deduplication ID contains the jobName plus a UUID suffix (not equal to jobName alone)', async () => {
      await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      const [call] = mockSqsClient.commandCalls(SendMessageCommand);
      const dedupId = call.args[0].input.MessageDeduplicationId;
      expect(dedupId).not.toBe(TARGET.jobName);
      expect(dedupId).toMatch(new RegExp(`^${TARGET.jobName}-.+`));
    });

    it('transitions model WAITING_FOR_CAPACITY -> QUEUED and training WAITING_FOR_CAPACITY -> QUEUED', async () => {
      await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      expect(modelDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId, profileId: TARGET.profileId },
        { from: ModelStatus.WAITING_FOR_CAPACITY, to: ModelStatus.QUEUED },
      );
      expect(trainingDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId },
        { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.QUEUED },
      );
    });

    it('loses the model conditional transition: sends no duplicate message, still returns QUEUED', async () => {
      vi.spyOn(modelDao, 'transitionStatus').mockRejectedValue(CONDITIONAL_CHECK_FAILED);

      const result = await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      expect(result).toEqual({ status: ModelStatus.QUEUED, message: CapacityMessage.DISPATCHED });
      expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
    });

    it('model transition wins but training transition fails with a non-conditional error: rolls back model and rethrows', async () => {
      const nonConditionalError = new Error('DynamoDB throttled');
      vi.spyOn(trainingDao, 'transitionStatus').mockRejectedValue(nonConditionalError);

      await expect(trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET)).rejects.toThrow(nonConditionalError);

      // Model must be rolled back QUEUED -> WAITING_FOR_CAPACITY.
      expect(modelDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId, profileId: TARGET.profileId },
        {
          from: ModelStatus.QUEUED,
          to: ModelStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.DISPATCH_FAILED,
        },
      );
      expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
    });

    it('model transition wins but training transition fails with a conditional-check error: logs warning and still sends the message', async () => {
      // Model succeeds; training job throws a conditional check (job was already QUEUED by a concurrent caller).
      vi.spyOn(trainingDao, 'transitionStatus').mockRejectedValue(CONDITIONAL_CHECK_FAILED);

      const result = await trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET);

      expect(result).toEqual({ status: ModelStatus.QUEUED, message: CapacityMessage.DISPATCHED });
      // The message is still sent by this caller since it won the model transition.
      expect(mockSqsClient.commandCalls(SendMessageCommand)).toHaveLength(1);
    });

    it('SQS send fails after successful QUEUED transition: rolls back both records to WAITING_FOR_CAPACITY and throws InternalFailureError', async () => {
      mockSqsClient.on(SendMessageCommand).rejects(new Error('SQS unavailable'));

      await expect(trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET)).rejects.toThrow(InternalFailureError);

      // Capacity was confirmed AVAILABLE before the send, so the persisted explanation must describe
      // the handoff failure — not claim that capacity could not be verified.
      // Model rollback.
      expect(modelDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId, profileId: TARGET.profileId },
        {
          from: ModelStatus.QUEUED,
          to: ModelStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.DISPATCH_FAILED,
        },
      );
      // Training job rollback.
      expect(trainingDao.transitionStatus).toHaveBeenCalledWith(
        { modelId: TARGET.modelId },
        {
          from: JobStatus.QUEUED,
          to: JobStatus.WAITING_FOR_CAPACITY,
          statusMessage: CapacityMessage.DISPATCH_FAILED,
        },
      );
    });

    it('model transition wins but non-conditional claimQueuedStatus error is rethrown (not swallowed)', async () => {
      const networkError = new Error('network timeout');
      // First call (model) throws a non-conditional error; claimQueuedStatus must rethrow it.
      vi.spyOn(modelDao, 'transitionStatus').mockRejectedValue(networkError);

      await expect(trainingDispatchHelper.dispatchIfCapacityAvailable(TARGET)).rejects.toThrow(networkError);
      expect(mockSqsClient).not.toHaveReceivedCommand(SendMessageCommand);
    });
  });
});
