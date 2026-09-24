// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';
import type { Context, SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * Processes messages from the Async Optimizer Dead Letter Queue.
 *
 * When the Model Optimizer Lambda fails all retry attempts, the Lambda service
 * sends the invocation record to asyncOptimizerDlq. This processor sets the
 * model's optimizationStatus to FAILED so it does not stay stuck in IN_PROGRESS.
 * The conditional update only applies if the model is still IN_PROGRESS (avoids
 * overwriting a successful late completion).
 *
 * Uses partial batch response (batchItemFailures) so transient errors cause
 * individual message retry rather than losing messages on acknowledgement.
 */
export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  logger.info(`Processing ${event.Records.length} optimizer DLQ messages`, {
    requestId: context.awsRequestId,
  });

  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      // Lambda async invocation failure records contain requestPayload with the original event
      let envelope;
      try {
        envelope = JSON.parse(record.body);
      } catch (parseError) {
        logger.warn('DLQ message body is not valid JSON, discarding', {
          error: parseError,
          messageId: record.messageId,
          body: record.body,
        });
        // Unparseable messages can never succeed on retry
        continue;
      }

      const payload = envelope.requestPayload ?? envelope;
      const { modelId, profileId } = payload;

      if (!modelId || !profileId) {
        logger.warn('DLQ message missing modelId or profileId, discarding', {
          messageId: record.messageId,
          body: record.body,
        });
        // Malformed messages are unrecoverable, don't retry
        continue;
      }

      // Atomically set FAILED only if still IN_PROGRESS (prevents clobbering a late success)
      try {
        await modelDao.setOptimizationFailed({ modelId, profileId });
      } catch (condError: unknown) {
        const err = condError as { name?: string; message?: string; cause?: { name?: string } };
        if (
          err.name === 'ConditionalCheckFailedException' ||
          err.cause?.name === 'ConditionalCheckFailedException' ||
          err.message?.includes('conditional request failed')
        ) {
          logger.info('Model no longer IN_PROGRESS, conditional write skipped', {
            modelId,
            profileId,
          });
          continue;
        }
        throw condError;
      }

      logger.info('Set optimizationStatus to FAILED', {
        modelId,
        profileId,
        messageId: record.messageId,
        failureReason: envelope.responsePayload?.errorMessage ?? 'unknown',
      });
    } catch (error) {
      logger.error('Failed to process optimizer DLQ message, will retry', {
        error,
        messageId: record.messageId,
        requestId: context.awsRequestId,
      });
      // Report as failed so SQS makes it visible again for retry
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

export const lambdaHandler: SQSHandler = instrumentHandler(handler);
