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
import { sageMakerHelper } from '../../utils/SageMakerHelper.js';
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

  it('should start workflow when sagemaker training instance capacity is available', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    vi.spyOn(sageMakerHelper, 'isTrainingInstanceCapacityAvailable').mockResolvedValueOnce(true);
    mockSfnClient.on(StartExecutionCommand).resolves({});

    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    expect(mockSfnClient.calls()).toHaveLength(1);
  });

  it('should not start workflow and throw error when sagemaker training instance capacity is not available', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.QUEUED });
    vi.spyOn(sageMakerHelper, 'isTrainingInstanceCapacityAvailable').mockResolvedValueOnce(false);

    await expect(
      JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
        /** empty callback */
      }),
    ).rejects.toEqual(new Error('SageMaker training instance capacity is not available. Message will be retried.'));

    expect(mockSfnClient).not.toHaveReceivedCommand(StartExecutionCommand);
  });

  it('should not start workflow when job status is CANCELED', async () => {
    vi.spyOn(workflowHelper, 'getJob').mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.CANCELED });

    await JobDispatcher({ Records: [MOCK_SQS_RECORD] }, {} as Context, () => {
      /** empty callback */
    });

    expect(mockSfnClient).not.toHaveReceivedCommand(SendMessageCommand);
  });
});
