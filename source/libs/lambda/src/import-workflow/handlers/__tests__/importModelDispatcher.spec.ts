// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { TrackConfig } from '@deepracer-indy/typescript-server-client';
import type { Context, SQSRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ImportModelDispatcher } from '../importModelDispatcher.js';

interface ImportModelContext {
  s3Location: string;
  profileId: string;
  modelId: string;
  modelName: string;
  modelDescription: string;
  rewardFunction: string;
  trackConfig: TrackConfig;
}

const MOCK_IMPORT_MODEL_INPUT: ImportModelContext = {
  s3Location: 's3://test-bucket/test-prefix/',
  profileId: 'test-profile-id',
  modelId: 'test-model-id',
  modelName: 'Test Model',
  modelDescription: 'Test Model Description',
  rewardFunction: 'def reward_function(params): return 1.0',
  trackConfig: {
    trackId: 'Oval_track',
    trackDirection: 'CLOCKWISE',
  },
};

const MOCK_SQS_RECORD: SQSRecord = {
  attributes: {
    MessageDeduplicationId: 'id',
    ApproximateReceiveCount: '1',
    SentTimestamp: 'testTimestamp',
    SenderId: 'testSenderId',
    ApproximateFirstReceiveTimestamp: 'testFirstReceiveTimestamp',
  },
  body: JSON.stringify(MOCK_IMPORT_MODEL_INPUT),
  md5OfBody: '6b8cd7713725a411e315d16532328910',
  messageId: '23f0626d-1281-4481-874e-5a9aa6b284cc',
  receiptHandle: 'AQEEZoCqZ4Tgu1EkVf59dNfsiMZ56oo5iXWUWPBKrcoRgG8X3CVQcvME6cXMB3lXHCiDo9HiPZyY=',
  messageAttributes: {},
  eventSource: 'testEventSource',
  eventSourceARN: 'testEventSourceArn',
  awsRegion: 'us-east-1',
};

vi.mock('#utils/metrics/metricsCollector.js');

describe('ImportModelDispatcher', () => {
  const mockSfnClient = mockClient(SFNClient);

  beforeEach(() => {
    mockSfnClient.reset();
    vi.clearAllMocks();
    process.env.IMPORT_MODEL_WORKFLOW_STATE_MACHINE_ARN = 'test-state-machine-arn';
  });

  it('should start import model workflow when SQS message is received', async () => {
    mockSfnClient.on(StartExecutionCommand).resolves({
      executionArn: 'test-execution-arn',
      startDate: new Date(),
    });

    await ImportModelDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    expect(mockSfnClient.calls()).toHaveLength(1);
    expect(mockSfnClient).toHaveReceivedCommandWith(StartExecutionCommand, {
      input: JSON.stringify(MOCK_IMPORT_MODEL_INPUT),
      stateMachineArn: 'test-state-machine-arn',
      name: expect.stringMatching(/^import-model-test-model-id-\d+$/),
    });
  });

  it('should throw error when Step Function execution fails', async () => {
    const error = new Error('Step Function execution failed');
    mockSfnClient.on(StartExecutionCommand).rejects(error);

    await expect(
      ImportModelDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
        /** empty callback */
      }),
    ).rejects.toThrow('Step Function execution failed');

    expect(mockSfnClient.calls()).toHaveLength(1);
  });

  it('should handle malformed SQS message body', async () => {
    const malformedRecord: SQSRecord = {
      ...MOCK_SQS_RECORD,
      body: 'invalid-json',
    };

    await expect(
      ImportModelDispatcher({ Records: [malformedRecord] }, {} as Context, () => {
        /** empty callback */
      }),
    ).rejects.toThrow();

    expect(mockSfnClient).not.toHaveReceivedCommand(StartExecutionCommand);
  });

  it('should use correct execution name format', async () => {
    const currentTime = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);

    mockSfnClient.on(StartExecutionCommand).resolves({
      executionArn: 'test-execution-arn',
      startDate: new Date(),
    });

    await ImportModelDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    expect(mockSfnClient).toHaveReceivedCommandWith(StartExecutionCommand, {
      input: JSON.stringify(MOCK_IMPORT_MODEL_INPUT),
      stateMachineArn: 'test-state-machine-arn',
      name: `import-model-test-model-id-${currentTime}`,
    });
  });
});
