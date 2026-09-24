// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';

import { SendMessageCommand, SendMessageCommandInput } from '@aws-sdk/client-sqs';
import {
  isConditionalCheckFailure,
  JobName,
  JobType,
  modelDao,
  ResourceId,
  trainingDao,
} from '@deepracer-indy/database';
import { InternalFailureError, JobStatus, ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';

import { sqsClient } from '../../utils/clients/sqsClient.js';
import { CapacityMessage } from '../../workflow/constants/capacityMessages.js';
import { CapacityStatus } from '../../workflow/types/capacityCheckResult.js';
import type { WorkflowContext } from '../../workflow/types/workflowContext.js';
import { sageMakerHelper } from '../../workflow/utils/SageMakerHelper.js';
import { DEFAULT_GROUP_MESSAGE_ID } from '../constants/sqs.js';

export type TrainingDispatchResult = {
  status: ModelStatus;
  message?: string;
};

type DispatchTarget = {
  modelId: ResourceId;
  profileId: ResourceId;
  jobName: JobName<JobType.TRAINING>;
};

/**
 * Shared admission path for training jobs, used by both CreateModel and RetryTraining.
 *
 * The model and training records already exist in `WAITING_FOR_CAPACITY` when this runs. Capacity is
 * checked here, and a workflow message is placed on the queue only when both SageMaker quotas have
 * room. The conditional `WAITING_FOR_CAPACITY -> QUEUED` transition on the model is the concurrency
 * gate: only the caller that wins it sends the message, so double-clicks and concurrent retries
 * cannot produce duplicates.
 */
class TrainingDispatchHelper {
  /**
   * Checks both SageMaker quotas and dispatches a workflow message when capacity is available.
   *
   * @returns `QUEUED` with a success message when a message was dispatched (or when another caller
   * already queued this job), otherwise `WAITING_FOR_CAPACITY` with an explanation.
   * @throws {InternalFailureError} when the queue send fails after the records were already moved to
   * `QUEUED`. The records are rolled back to `WAITING_FOR_CAPACITY` first so the user can retry.
   */
  @logMethod
  async dispatchIfCapacityAvailable(target: DispatchTarget): Promise<TrainingDispatchResult> {
    const capacity = await sageMakerHelper.checkTrainingCapacity();

    if (capacity.status !== CapacityStatus.AVAILABLE) {
      const message =
        capacity.status === CapacityStatus.UNAVAILABLE ? CapacityMessage.UNAVAILABLE : CapacityMessage.UNKNOWN;

      logger.warn('Training capacity not confirmed; leaving job in WAITING_FOR_CAPACITY and sending no message', {
        ...target,
        capacityStatus: capacity.status,
        reason: capacity.status === CapacityStatus.UNAVAILABLE ? capacity.reason : undefined,
      });

      await this.persistWaitingMessage(target, message);

      return { status: ModelStatus.WAITING_FOR_CAPACITY, message };
    }

    const wonTransition = await this.claimQueuedStatus(target);

    if (!wonTransition) {
      // Another concurrent request already moved this job to QUEUED and owns the message send.
      logger.info('Job is already QUEUED; not sending a duplicate workflow message', target);
      return { status: ModelStatus.QUEUED, message: CapacityMessage.DISPATCHED };
    }

    try {
      await this.sendWorkflowMessage(target);
    } catch (error) {
      logger.error('Failed to send workflow message after transitioning to QUEUED; rolling back', {
        ...target,
        error,
      });
      await this.rollbackToWaiting(target, CapacityMessage.DISPATCH_FAILED);
      // Same wording as the persisted statusMessage, so the API error and the model detail page tell
      // the user the same story.
      throw new InternalFailureError({ message: CapacityMessage.DISPATCH_FAILED });
    }

    return { status: ModelStatus.QUEUED, message: CapacityMessage.DISPATCHED };
  }

  /**
   * Records the capacity explanation on both records while leaving them in `WAITING_FOR_CAPACITY`.
   * A failure here is logged rather than thrown: the records are already in the correct status, and
   * the message is explanatory only.
   */
  private async persistWaitingMessage(
    { modelId, profileId }: Pick<DispatchTarget, 'modelId' | 'profileId'>,
    statusMessage: string,
  ) {
    try {
      await modelDao.transitionStatus(
        { modelId, profileId },
        { from: ModelStatus.WAITING_FOR_CAPACITY, to: ModelStatus.WAITING_FOR_CAPACITY, statusMessage },
      );
      await trainingDao.transitionStatus(
        { modelId },
        { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.WAITING_FOR_CAPACITY, statusMessage },
      );
    } catch (error) {
      logger.warn('Unable to persist capacity-waiting message', { modelId, profileId, error });
    }
  }

  /**
   * Attempts the conditional `WAITING_FOR_CAPACITY -> QUEUED` transition on the model and then the
   * training job, clearing the capacity message.
   *
   * @returns true when this caller won the transition and therefore owns the message send.
   */
  private async claimQueuedStatus({
    modelId,
    profileId,
  }: Pick<DispatchTarget, 'modelId' | 'profileId'>): Promise<boolean> {
    try {
      await modelDao.transitionStatus(
        { modelId, profileId },
        { from: ModelStatus.WAITING_FOR_CAPACITY, to: ModelStatus.QUEUED },
      );
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return false;
      }
      throw error;
    }

    try {
      await trainingDao.transitionStatus({ modelId }, { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.QUEUED });
    } catch (error) {
      if (!isConditionalCheckFailure(error)) {
        // The model is QUEUED but the job is not; roll the model back so the pair stays consistent
        // and the user can retry. Capacity was confirmed available, so this is a handoff failure.
        await this.rollbackToWaiting({ modelId, profileId }, CapacityMessage.DISPATCH_FAILED);
        throw error;
      }
      logger.warn('Training job was no longer WAITING_FOR_CAPACITY during transition to QUEUED', {
        modelId,
        profileId,
      });
    }

    return true;
  }

  /**
   * Best-effort conditional rollback of both records from `QUEUED` back to `WAITING_FOR_CAPACITY`.
   *
   * @param statusMessage the explanation to persist. The caller supplies it because a rollback is not
   * always a capacity problem — by the time this runs, capacity has usually already been confirmed
   * available and the failure is in the handoff.
   */
  private async rollbackToWaiting(
    { modelId, profileId }: Pick<DispatchTarget, 'modelId' | 'profileId'>,
    statusMessage: string,
  ) {
    try {
      await modelDao.transitionStatus(
        { modelId, profileId },
        {
          from: ModelStatus.QUEUED,
          to: ModelStatus.WAITING_FOR_CAPACITY,
          statusMessage,
        },
      );
      await trainingDao.transitionStatus(
        { modelId },
        {
          from: JobStatus.QUEUED,
          to: JobStatus.WAITING_FOR_CAPACITY,
          statusMessage,
        },
      );
    } catch (error) {
      // The model may now be QUEUED in DynamoDB with no corresponding SQS message. Log loudly so an
      // operator can reconcile it.
      logger.error('Unable to roll back training job to WAITING_FOR_CAPACITY', { modelId, profileId, error });
    }
  }

  private async sendWorkflowMessage({ modelId, profileId, jobName }: DispatchTarget) {
    const workflowInput: WorkflowContext<JobType.TRAINING> = { modelId, profileId, jobName };

    const sendMessageCommandInput: SendMessageCommandInput = {
      QueueUrl: process.env.WORKFLOW_JOB_QUEUE_URL,
      MessageBody: JSON.stringify(workflowInput),
      MessageGroupId: DEFAULT_GROUP_MESSAGE_ID,
      // A fresh deduplication ID per attempt: reusing the training job name would make a manual
      // retry fall inside the FIFO 5-minute deduplication window and be silently dropped.
      MessageDeduplicationId: `${jobName}-${randomUUID()}`,
    };

    logger.info('Sending workflow SQS message', { workflowInput, sendMessageCommandInput });

    const sendMessageResponse = await sqsClient.send(new SendMessageCommand(sendMessageCommandInput));

    logger.info('Successfully added message to queue', { sendMessageResponse });
  }
}

export const trainingDispatchHelper = new TrainingDispatchHelper();
