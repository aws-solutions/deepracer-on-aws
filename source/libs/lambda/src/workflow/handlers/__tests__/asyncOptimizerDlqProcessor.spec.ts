// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../asyncOptimizerDlqProcessor.js';

vi.mock('@deepracer-indy/database');
vi.mock('@deepracer-indy/utils');

describe('Async Optimizer DLQ Processor', () => {
  const mockContext = { awsRequestId: 'req-123' } as Context;

  const createRecord = (body: string, messageId = 'msg-1'): SQSRecord =>
    ({
      messageId,
      body,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1234567890',
        SenderId: 'sender',
        ApproximateFirstReceiveTimestamp: '1234567890',
      },
      messageAttributes: {},
      md5OfBody: 'md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:dlq',
      awsRegion: 'us-east-1',
      receiptHandle: 'handle',
    }) as SQSRecord;

  const makeEnvelope = (modelId: string, profileId: string, errorMessage = 'OOM') =>
    JSON.stringify({
      requestPayload: { modelId, profileId },
      responsePayload: { errorMessage },
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set optimizationStatus to FAILED when model is still IN_PROGRESS', async () => {
    vi.spyOn(modelDao, 'setOptimizationFailed').mockResolvedValue(undefined);

    const event: SQSEvent = { Records: [createRecord(makeEnvelope('model-1', 'profile-1'))] };
    const result = await handler(event, mockContext);

    expect(modelDao.setOptimizationFailed).toHaveBeenCalledWith({
      modelId: 'model-1',
      profileId: 'profile-1',
    });
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('should skip when conditional write fails (model no longer IN_PROGRESS)', async () => {
    const condError = Object.assign(new Error('conditional request failed'), {
      cause: { name: 'ConditionalCheckFailedException' },
    });
    vi.spyOn(modelDao, 'setOptimizationFailed').mockRejectedValue(condError);

    const event: SQSEvent = { Records: [createRecord(makeEnvelope('model-1', 'profile-1'))] };
    const result = await handler(event, mockContext);

    expect(result.batchItemFailures).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      'Model no longer IN_PROGRESS, conditional write skipped',
      expect.anything(),
    );
  });

  it('should discard malformed messages (missing fields) without retry', async () => {
    const body = JSON.stringify({ requestPayload: { profileId: 'profile-1' } });
    const event: SQSEvent = { Records: [createRecord(body)] };
    const result = await handler(event, mockContext);

    expect(modelDao.setOptimizationFailed).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('should parse flat payload (no requestPayload wrapper) as fallback', async () => {
    const body = JSON.stringify({ modelId: 'model-2', profileId: 'profile-2' });
    vi.spyOn(modelDao, 'setOptimizationFailed').mockResolvedValue(undefined);

    const event: SQSEvent = { Records: [createRecord(body)] };
    const result = await handler(event, mockContext);

    expect(modelDao.setOptimizationFailed).toHaveBeenCalledWith({
      modelId: 'model-2',
      profileId: 'profile-2',
    });
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('should discard invalid JSON without retry (permanently unparseable)', async () => {
    const event: SQSEvent = { Records: [createRecord('not json', 'bad-msg')] };
    const result = await handler(event, mockContext);

    expect(result.batchItemFailures).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith('DLQ message body is not valid JSON, discarding', expect.anything());
  });

  it('should report transient DDB errors as failures for retry', async () => {
    vi.spyOn(modelDao, 'setOptimizationFailed').mockRejectedValue(new Error('DDB timeout'));

    const event: SQSEvent = { Records: [createRecord(makeEnvelope('model-1', 'profile-1'), 'fail-msg')] };
    const result = await handler(event, mockContext);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'fail-msg' }]);
  });

  it('should report only failed records while processing successful ones', async () => {
    vi.spyOn(modelDao, 'setOptimizationFailed')
      .mockRejectedValueOnce(new Error('DDB timeout'))
      .mockResolvedValueOnce(undefined);

    const event: SQSEvent = {
      Records: [
        createRecord(makeEnvelope('model-1', 'profile-1'), 'msg-1'),
        createRecord(makeEnvelope('model-2', 'profile-2'), 'msg-2'),
      ],
    };
    const result = await handler(event, mockContext);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
    expect(modelDao.setOptimizationFailed).toHaveBeenCalledTimes(2);
  });
});
