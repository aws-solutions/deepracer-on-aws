// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { Context, SQSEvent, SQSHandler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * Processes messages from the Import Model Job Dead Letter Queue
 *
 * When SQS messages fail processing and are sent to the DLQ, this function
 * updates the corresponding model status to ERROR to prevent stuck IMPORTING states.
 *
 * @param event - SQS DLQ event containing failed messages
 * @param context - Lambda execution context
 */
export async function handler(event: SQSEvent, context: Context): Promise<void> {
  logger.info(`Processing ${event.Records.length} DLQ messages`, {
    requestId: context.awsRequestId,
  });

  for (const record of event.Records) {
    try {
      // Parse the original message that failed
      const importContext = JSON.parse(record.body);
      const { modelId, profileId } = importContext;

      if (!modelId || !profileId) {
        logger.warn('DLQ message missing modelId or profileId', {
          messageId: record.messageId,
          body: record.body,
        });
        continue;
      }
      const genericErrorMessage = `Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: ${context.awsRequestId}`;
      await modelDao.update(
        { modelId, profileId },
        { status: ModelStatus.ERROR, importErrorMessage: genericErrorMessage },
      );

      logger.info('Successfully updated model status to ERROR', {
        modelId,
        profileId,
        messageId: record.messageId,
      });
    } catch (error) {
      logger.error('Failed to process DLQ message', {
        error,
        messageId: record.messageId,
        requestId: context.awsRequestId,
      });
      // Don't throw error - we want to acknowledge the DLQ message
    }
  }
}

export const lambdaHandler: SQSHandler = instrumentHandler(handler);
