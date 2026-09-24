// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InvokeCommand } from '@aws-sdk/client-lambda';
import { StartExecutionCommand, StartExecutionCommandInput } from '@aws-sdk/client-sfn';
import { ModelSource, TrackConfig } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { SQSHandler } from 'aws-lambda';

import { lambdaClient } from '../../utils/clients/lambdaClient.js';
import { sfnClient } from '../../utils/clients/sfnClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

interface VirtualImportContext {
  s3Location: string;
  profileId: string;
  modelId: string;
  modelName: string;
  modelDescription: string;
  rewardFunction: string;
  trackConfig: TrackConfig;
}

interface PhysicalImportContext {
  importType: ModelSource;
  modelId: string;
  profileId: string;
  s3Location: string;
  modelName: string;
}

/**
 * Processes messages from the ImportModelJobQueue. Routes based on importType:
 * - PHYSICAL: invokes Model Optimizer Lambda synchronously. On failure, the
 *   message returns to the queue for retry (maxReceiveCount: 2) then DLQ.
 * - VIRTUAL (or absent): starts the Import Model Step Functions workflow.
 */
export const ImportModelDispatcher: SQSHandler = async (event) => {
  const sqsMessage = event.Records[0];

  logger.info('START ImportModelDispatcher task', { sqsMessage });

  try {
    const messageBody = JSON.parse(sqsMessage.body);

    if (messageBody.importType === ModelSource.IMPORTED_PHYSICAL) {
      await handlePhysicalImport(messageBody as PhysicalImportContext);
    } else {
      await handleVirtualImport(messageBody as VirtualImportContext, sqsMessage.body);
    }
  } catch (error) {
    logger.error('EXCEPTION ImportModelDispatcher task: Unable to process import message.', {
      sqsMessage,
      error,
    });
    throw error;
  }
};

async function handlePhysicalImport(importContext: PhysicalImportContext): Promise<void> {
  const functionName = process.env.MODEL_OPTIMIZER_FUNCTION_NAME;
  if (!functionName) {
    throw new Error('MODEL_OPTIMIZER_FUNCTION_NAME environment variable is not configured');
  }

  logger.info('Invoking Model Optimizer synchronously for physical import', {
    modelId: importContext.modelId,
    profileId: importContext.profileId,
  });

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        modelId: importContext.modelId,
        profileId: importContext.profileId,
        s3Location: importContext.s3Location,
        modelName: importContext.modelName,
        importType: ModelSource.IMPORTED_PHYSICAL,
      }),
    }),
  );

  // Check for Lambda-level errors (function error, not invocation error)
  if (response.FunctionError) {
    let errorMessage = response.FunctionError;
    if (response.Payload) {
      try {
        const errorPayload = JSON.parse(new TextDecoder().decode(response.Payload));
        errorMessage = errorPayload.errorMessage ?? response.FunctionError;
      } catch {
        // Malformed payload, fall back to FunctionError string
      }
    }
    throw new Error(`Model Optimizer failed: ${errorMessage}`);
  }

  logger.info('END ImportModelDispatcher task. Model Optimizer completed successfully for physical import.', {
    modelId: importContext.modelId,
  });
}

async function handleVirtualImport(importContext: VirtualImportContext, rawBody: string): Promise<void> {
  const { modelId } = importContext;

  const startExecutionInput: StartExecutionCommandInput = {
    input: rawBody,
    stateMachineArn: process.env.IMPORT_MODEL_WORKFLOW_STATE_MACHINE_ARN,
    name: `import-model-${modelId}-${Date.now()}`,
  };

  logger.info('Starting import model workflow execution.', { startExecutionInput });

  const startExecutionResponse = await sfnClient.send(new StartExecutionCommand(startExecutionInput));

  logger.info('END ImportModelDispatcher task. Successfully processed message and started import workflow.', {
    startExecutionResponse,
  });
}

export const lambdaHandler = instrumentHandler(ImportModelDispatcher);
