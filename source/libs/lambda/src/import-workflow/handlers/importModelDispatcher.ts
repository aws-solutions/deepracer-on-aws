// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand, StartExecutionCommandInput } from '@aws-sdk/client-sfn';
import { TrackConfig } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { SQSHandler } from 'aws-lambda';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

interface ImportModelContext {
  s3Location: string;
  profileId: string;
  modelId: string;
  modelName: string;
  modelDescription: string;
  rewardFunction: string;
  trackConfig: TrackConfig;
}

/**
 * The ImportModelDispatcher lambda is a SQS handler that processes messages from the ImportModelJobQueue.
 * This dispatcher starts the import model workflow using the information in the message.
 */
export const ImportModelDispatcher: SQSHandler = async (event) => {
  const sqsMessage = event.Records[0];

  logger.info('START ImportModelDispatcher task', { sqsMessage });

  try {
    const importContext = JSON.parse(sqsMessage.body) as ImportModelContext;
    const { modelId } = importContext;

    const startExecutionInput: StartExecutionCommandInput = {
      input: sqsMessage.body,
      stateMachineArn: process.env.IMPORT_MODEL_WORKFLOW_STATE_MACHINE_ARN,
      name: `import-model-${modelId}-${Date.now()}`,
    };

    logger.info('Starting import model workflow execution.', { startExecutionInput });

    const startExecutionResponse = await sfnClient.send(new StartExecutionCommand(startExecutionInput));

    logger.info('END ImportModelDispatcher task. Successfully processed message and started import workflow.', {
      sqsMessage,
      startExecutionResponse,
    });
  } catch (error) {
    logger.error('EXCEPTION ImportModelDispatcher task: Unable to start import model workflow execution.', {
      sqsMessage,
      error,
    });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(ImportModelDispatcher);
