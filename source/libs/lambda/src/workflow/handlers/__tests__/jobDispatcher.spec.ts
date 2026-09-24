// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { JobType, TEST_TRAINING_ITEM } from '@deepracer-indy/database';
import { JobStatus } from '@deepracer-indy/typescript-server-client';
import type { Context, SQSRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';

import { sleepHelper } from '../../../utils/SleepHelper.js';
import type { WorkflowContext } from '../../types/workflowContext.js';
import { workflowHelper } from '../../utils/WorkflowHelper.js';
import { JobDispatcher } from '../jobDispatcher.js';

const MOCK_WORKFLOW_INPUT: WorkflowContext<JobType.TRAINING> = {
  jobName: TEST_TRAINING_ITEM.name,
  modelId: TEST_TRAINING_ITEM.modelId,
  profileId: TEST_TRAINING_ITEM.profileId,
};

const MOCK_SQS_RECORD: SQSRecord = {
  attributes: {
    MessageDeduplicationId: 'id',
    ApproximateReceiveCount: '1',
    SentTimestamp: 'testTimestamp',
    SenderId: 'testSenderId',
    ApproximateFirstReceiveTimestamp: 'testFirstReceiveTimestamp',
  },
  body: JSON.stringify(MOCK_WORKFLOW_INPUT),
  md5OfBody: '6b8cd7713725a411e315d16532328910',
  messageId: '23f0626d-1281-4481-874e-5a9aa6b284cc',
  receiptHandle: 'AQEEZoCqZ4Tgu1EkVf59dNfsiMZ56oo5iXWUWPBKrcoRgG8X3CVQcvME6cXMB3lXHCiDo9HiPZyY=',
  messageAttributes: {},
  eventSource: 'testEventSource',
  eventSourceARN: 'testEventSourceArn',
  awsRegion: 'us-east-1',
};

vi.mock('#utils/metrics/metricsCollector.js');

describe('JobDispatcher', () => {
  const mockSfnClient = mockClient(SFNClient);

  beforeEach(() => {
    mockSfnClient.reset();
    vi.spyOn(sleepHelper, 'sleep').mockResolvedValue();
  });

  it('should start a workflow execution for a queued job', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    mockSfnClient.on(StartExecutionCommand).resolves({});

    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    expect(mockSfnClient.calls()).toHaveLength(1);
  });

  it('should derive a stable execution name so a redelivered message cannot start a duplicate', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValue({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    mockSfnClient.on(StartExecutionCommand).resolves({});
    // Advance the clock between deliveries so a wall-clock-derived name would differ. This is what
    // makes the assertion a real guard: the name has to come from the message, not from time.
    let now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 60_000));

    // SQS delivery is at-least-once: the same message can arrive more than once.
    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });
    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    const [first, second] = mockSfnClient.commandCalls(StartExecutionCommand);
    // Identical names mean the redundant StartExecution is rejected with ExecutionAlreadyExists
    // rather than starting a second concurrent workflow for the same training job.
    expect(second.args[0].input.name).toBe(first.args[0].input.name);
    expect(first.args[0].input.name).toMatch(new RegExp(`^${TEST_TRAINING_ITEM.name}-[0-9a-f]+$`));
    // Step Functions rejects execution names longer than 80 characters.
    expect((first.args[0].input.name ?? '').length).toBeLessThanOrEqual(80);
  });

  it('should derive a different execution name for a genuine new dispatch attempt', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValue({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    mockSfnClient.on(StartExecutionCommand).resolves({});

    // A manual RetryTraining reuses the deterministic job name but sends a new message with a fresh
    // deduplication ID, so the completed execution's name is not reused.
    const retryRecord: SQSRecord = {
      ...MOCK_SQS_RECORD,
      messageId: 'a-different-message-id',
      attributes: { ...MOCK_SQS_RECORD.attributes, MessageDeduplicationId: 'a-different-dedup-id' },
    };

    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });
    await JobDispatcher({ Records: [retryRecord] }, {} as Context, () => {
      /** empty callback */
    });

    const [first, second] = mockSfnClient.commandCalls(StartExecutionCommand);
    expect(second.args[0].input.name).not.toBe(first.args[0].input.name);
  });

  it('should fall back to the message ID when no deduplication ID is present', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValue({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    mockSfnClient.on(StartExecutionCommand).resolves({});

    const attributesWithoutDedupId = { ...MOCK_SQS_RECORD.attributes };
    delete attributesWithoutDedupId.MessageDeduplicationId;
    const record: SQSRecord = { ...MOCK_SQS_RECORD, attributes: attributesWithoutDedupId };

    await JobDispatcher({ Records: [record] }, {} as Context, () => {
      /** empty callback */
    });
    await JobDispatcher({ Records: [record] }, {} as Context, () => {
      /** empty callback */
    });

    const [first, second] = mockSfnClient.commandCalls(StartExecutionCommand);
    expect(second.args[0].input.name).toBe(first.args[0].input.name);
  });

  it('should discard a redelivered message when the execution already exists', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    mockSfnClient
      .on(StartExecutionCommand)
      .rejects(Object.assign(new Error('Execution Already Exists'), { name: 'ExecutionAlreadyExists' }));

    // Must not rethrow: the work is already in flight, so requeueing would only churn the message
    // until it reached the DLQ.
    await expect(
      JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
        /** empty callback */
      }),
    ).resolves.toBeUndefined();
  });

  it('should requeue the message when StartExecution fails for any other reason', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    mockSfnClient.on(StartExecutionCommand).rejects(new Error('ThrottlingException'));

    await expect(
      JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
        /** empty callback */
      }),
    ).rejects.toThrow('ThrottlingException');
  });

  it('should not start workflow when job status is CANCELED', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.CANCELED });

    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    expect(mockSfnClient).not.toHaveReceivedCommand(SendMessageCommand);
  });
});
