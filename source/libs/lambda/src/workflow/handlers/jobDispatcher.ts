// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';

import { StartExecutionCommand, StartExecutionCommandInput } from '@aws-sdk/client-sfn';
import { JobStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { SQSHandler, SQSRecord } from 'aws-lambda';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { sleepHelper } from '../../utils/SleepHelper.js';
import type { WorkflowContext } from '../types/workflowContext.js';
import { workflowHelper } from '../utils/WorkflowHelper.js';

/** Step Functions error name returned when an execution with the requested name already exists. */
const EXECUTION_ALREADY_EXISTS_ERROR_NAME = 'ExecutionAlreadyExists';

/**
 * Hex characters of the attempt-token hash appended to the job name. Long enough that two distinct
 * attempts for the same job will not collide, short enough to keep the execution name well inside the
 * 80-character Step Functions limit.
 */
const ATTEMPT_TOKEN_LENGTH = 10;

/**
 * Derives the Step Functions execution name for this dispatch attempt.
 *
 * The name has to satisfy two competing requirements:
 *
 * - **Stable across redeliveries.** SQS delivery is at-least-once and this handler rethrows to
 *   requeue on any error, so the same message can arrive more than once. A stable name makes the
 *   redundant StartExecution fail with ExecutionAlreadyExists instead of starting a second concurrent
 *   workflow — which would race the first on the deterministic SageMaker training job and Kinesis
 *   stream names and could mark a healthy training run as ERROR.
 * - **Fresh for a genuine retry.** A Standard execution name cannot be reused once the execution has
 *   completed, and RetryTraining deliberately reuses the deterministic job name, so the job name
 *   alone will not do.
 *
 * The per-attempt token therefore comes from the message itself rather than from wall-clock time: its
 * FIFO deduplication ID, or its message ID as a fallback. Both are assigned once when the message is
 * sent and survive redelivery, while a genuine manual retry sends a new message and so gets a new
 * token. The token is hashed to bound the name length.
 */
const getExecutionName = (sqsMessage: SQSRecord, jobName: string) => {
  const attemptToken = sqsMessage.attributes.MessageDeduplicationId ?? sqsMessage.messageId;
  const suffix = createHash('sha256').update(attemptToken).digest('hex').slice(0, ATTEMPT_TOKEN_LENGTH);

  return `${jobName}-${suffix}`;
};

/**
 * The JobDispatcher lambda is a SQS handler that processes messages from the WorkflowJobQueue.
 *
 * A message only reaches this queue after CreateModel or RetryTraining confirmed SageMaker capacity,
 * so the dispatcher does not gate on capacity itself and never returns a message to the queue to
 * wait for it. JobInitializer rechecks capacity immediately before CreateTrainingJob and moves the
 * job back to WAITING_FOR_CAPACITY if capacity disappeared in the meantime.
 *
 * Note: Errors thrown in this lambda will return message to queue for reprocessing.
 */
export const JobDispatcher: SQSHandler = async (event) => {
  const sqsMessage = event.Records[0];

  logger.info('START JobDispatcher task', { sqsMessage });

  try {
    const { jobName, modelId, profileId, leaderboardId } = JSON.parse(sqsMessage.body) as WorkflowContext;

    const jobItem = await workflowHelper.getJob({ jobName, modelId, profileId, leaderboardId });

    if (jobItem.status === JobStatus.CANCELED) {
      logger.info('Job canceled via StopModel API prior to initialization, discarding SQS message');
      return;
    }

    // This 4 second sleep ensures the previously dispatched job has started its SageMaker training instance
    // and prevents SageMaker CreateTrainingJob throttling in JobInitializer
    await sleepHelper.sleep(4000);

    const startExecutionInput: StartExecutionCommandInput = {
      input: sqsMessage.body,
      stateMachineArn: process.env.WORKFLOW_STATE_MACHINE_ARN,
      name: getExecutionName(sqsMessage, jobName),
    };

    logger.info('Starting workflow execution.', { startExecutionInput });

    try {
      const startExecutionResponse = await sfnClient.send(new StartExecutionCommand(startExecutionInput));

      logger.info('END JobDispatcher task. Successfully processed message and started workflow.', {
        sqsMessage,
        startExecutionResponse,
      });
    } catch (error) {
      if ((error as { name?: string })?.name !== EXECUTION_ALREADY_EXISTS_ERROR_NAME) {
        throw error;
      }

      // This attempt already started a workflow, so the message is a redelivery. Discard it instead
      // of requeueing: the work is already in flight, and rethrowing would only churn the message
      // until it reached the DLQ.
      logger.info('Workflow execution already exists for this attempt, discarding redelivered SQS message', {
        executionName: startExecutionInput.name,
        sqsMessage,
      });
    }
  } catch (error) {
    logger.error('EXCEPTION JobDispatcher task: Unable to start workflow execution.', { sqsMessage, error });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(JobDispatcher);
