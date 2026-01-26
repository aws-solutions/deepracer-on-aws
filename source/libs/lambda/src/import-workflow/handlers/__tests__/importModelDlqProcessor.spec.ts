// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, ResourceId, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../importModelDlqProcessor.js';

vi.mock('@deepracer-indy/database');
vi.mock('@deepracer-indy/utils');

describe('Import Model DLQ Processor', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
  } as Context;

  const mockModelId = 'test-model-id' as ResourceId;
  const mockProfileId = 'test-profile-id' as ResourceId;

  const createSqsRecord = (body: string, messageId = 'test-message-id'): SQSRecord => ({
    messageId,
    receiptHandle: 'test-receipt-handle',
    body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1234567890',
      SenderId: 'test-sender',
      ApproximateFirstReceiveTimestamp: '1234567890',
    },
    messageAttributes: {},
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
    awsRegion: 'us-east-1',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelDao.update).mockResolvedValue(TEST_MODEL_ITEM);
  });

  it('should successfully process DLQ message and update model status', async () => {
    const messageBody = JSON.stringify({
      modelId: mockModelId,
      profileId: mockProfileId,
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    await handler(event, mockContext);

    expect(logger.info).toHaveBeenCalledWith('Processing 1 DLQ messages', {
      requestId: 'test-request-id',
    });

    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );

    expect(logger.info).toHaveBeenCalledWith('Successfully updated model status to ERROR', {
      modelId: mockModelId,
      profileId: mockProfileId,
      messageId: 'test-message-id',
    });
  });

  it('should process multiple DLQ messages', async () => {
    const messageBody1 = JSON.stringify({
      modelId: 'model-1',
      profileId: 'profile-1',
    });

    const messageBody2 = JSON.stringify({
      modelId: 'model-2',
      profileId: 'profile-2',
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody1, 'message-1'), createSqsRecord(messageBody2, 'message-2')],
    };

    await handler(event, mockContext);

    expect(logger.info).toHaveBeenCalledWith('Processing 2 DLQ messages', {
      requestId: 'test-request-id',
    });

    expect(modelDao.update).toHaveBeenCalledTimes(2);
    expect(modelDao.update).toHaveBeenNthCalledWith(
      1,
      { modelId: 'model-1', profileId: 'profile-1' },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
    expect(modelDao.update).toHaveBeenNthCalledWith(
      2,
      { modelId: 'model-2', profileId: 'profile-2' },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should skip message when modelId is missing', async () => {
    const messageBody = JSON.stringify({
      profileId: mockProfileId,
      // modelId is missing
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    await handler(event, mockContext);

    expect(logger.warn).toHaveBeenCalledWith('DLQ message missing modelId or profileId', {
      messageId: 'test-message-id',
      body: messageBody,
    });

    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should skip message when profileId is missing', async () => {
    const messageBody = JSON.stringify({
      modelId: mockModelId,
      // profileId is missing
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    await handler(event, mockContext);

    expect(logger.warn).toHaveBeenCalledWith('DLQ message missing modelId or profileId', {
      messageId: 'test-message-id',
      body: messageBody,
    });

    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should skip message when both modelId and profileId are missing', async () => {
    const messageBody = JSON.stringify({
      someOtherProperty: 'value',
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    await handler(event, mockContext);

    expect(logger.warn).toHaveBeenCalledWith('DLQ message missing modelId or profileId', {
      messageId: 'test-message-id',
      body: messageBody,
    });

    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should handle JSON parsing errors gracefully', async () => {
    const invalidJson = '{ invalid json }';

    const event: SQSEvent = {
      Records: [createSqsRecord(invalidJson)],
    };

    await handler(event, mockContext);

    expect(logger.error).toHaveBeenCalledWith('Failed to process DLQ message', {
      error: expect.any(Error),
      messageId: 'test-message-id',
      requestId: 'test-request-id',
    });

    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should handle database update errors gracefully', async () => {
    const messageBody = JSON.stringify({
      modelId: mockModelId,
      profileId: mockProfileId,
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    const dbError = new Error('Database update failed');
    vi.mocked(modelDao.update).mockRejectedValue(dbError);

    await handler(event, mockContext);

    expect(logger.error).toHaveBeenCalledWith('Failed to process DLQ message', {
      error: dbError,
      messageId: 'test-message-id',
      requestId: 'test-request-id',
    });

    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });

  it('should continue processing other messages when one fails', async () => {
    const validMessageBody = JSON.stringify({
      modelId: 'valid-model',
      profileId: 'valid-profile',
    });

    const invalidJson = '{ invalid json }';

    const event: SQSEvent = {
      Records: [createSqsRecord(invalidJson, 'invalid-message'), createSqsRecord(validMessageBody, 'valid-message')],
    };

    await handler(event, mockContext);

    expect(logger.error).toHaveBeenCalledWith('Failed to process DLQ message', {
      error: expect.any(Error),
      messageId: 'invalid-message',
      requestId: 'test-request-id',
    });

    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: 'valid-model', profileId: 'valid-profile' },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );

    expect(logger.info).toHaveBeenCalledWith('Successfully updated model status to ERROR', {
      modelId: 'valid-model',
      profileId: 'valid-profile',
      messageId: 'valid-message',
    });
  });

  it('should log appropriate messages during processing', async () => {
    const messageBody = JSON.stringify({
      modelId: mockModelId,
      profileId: mockProfileId,
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    await handler(event, mockContext);

    expect(logger.info).toHaveBeenCalledWith('Processing 1 DLQ messages', {
      requestId: 'test-request-id',
    });

    expect(logger.info).toHaveBeenCalledWith('Successfully updated model status to ERROR', {
      modelId: mockModelId,
      profileId: mockProfileId,
      messageId: 'test-message-id',
    });
  });

  it('should handle empty event records', async () => {
    const event: SQSEvent = {
      Records: [],
    };

    await handler(event, mockContext);

    expect(logger.info).toHaveBeenCalledWith('Processing 0 DLQ messages', {
      requestId: 'test-request-id',
    });

    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should use correct error message format with request ID', async () => {
    const messageBody = JSON.stringify({
      modelId: mockModelId,
      profileId: mockProfileId,
    });

    const event: SQSEvent = {
      Records: [createSqsRecord(messageBody)],
    };

    await handler(event, mockContext);

    expect(modelDao.update).toHaveBeenCalledWith(
      { modelId: mockModelId, profileId: mockProfileId },
      {
        status: ModelStatus.ERROR,
        importErrorMessage:
          'Unexpected error occurred while processing the model import. Please try again in few minutes or contact support if issue persists with Request ID: test-request-id',
      },
    );
  });
});
