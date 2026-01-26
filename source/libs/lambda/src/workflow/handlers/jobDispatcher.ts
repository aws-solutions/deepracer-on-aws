// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand, StartExecutionCommandInput } from '@aws-sdk/client-sfn';
import { JobStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { SQSHandler } from 'aws-lambda';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { sleepHelper } from '../../utils/SleepHelper.js';
import type { WorkflowContext } from '../types/workflowContext.js';
import { sageMakerHelper } from '../utils/SageMakerHelper.js';
import { workflowHelper } from '../utils/WorkflowHelper.js';

/**
 * The JobDispatcher lambda is a SQS handler that processes messages from the WorkflowJobQueue.
 *
 * If SageMaker resources are available, a workflow will be started using the information in the message.
 * If SageMaker resources are unavailable, the message will be returned to the queue for reprocessing.
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

    if (!(await sageMakerHelper.isTrainingInstanceCapacityAvailable())) {
      logger.warn(
        'SageMaker training instance quota reached. Returning message to queue to wait for available capacity.',
        {
          sqsMessage,
        },
      );

      throw new Error('SageMaker training instance capacity is not available. Message will be retried.');
    }

    const startExecutionInput: StartExecutionCommandInput = {
      input: sqsMessage.body,
      stateMachineArn: process.env.WORKFLOW_STATE_MACHINE_ARN,
      name: jobName,
    };

    logger.info('Starting workflow execution.', { startExecutionInput });

    const startExecutionResponse = await sfnClient.send(new StartExecutionCommand(startExecutionInput));

    logger.info('END JobDispatcher task. Successfully processed message and started workflow.', {
      sqsMessage,
      startExecutionResponse,
    });
  } catch (error) {
    logger.error('EXCEPTION JobDispatcher task: Unable to start workflow execution.', { sqsMessage, error });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(JobDispatcher);
