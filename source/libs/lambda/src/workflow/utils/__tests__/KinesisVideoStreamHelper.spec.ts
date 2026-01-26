// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateStreamCommand,
  DeleteStreamCommand,
  KinesisVideoClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-kinesis-video';
import { JobName, JobType } from '@deepracer-indy/database';
import { mockClient } from 'aws-sdk-client-mock';

import { KVS_MEDIA_TYPE, StreamDataRetentionInHours } from '../../constants/kvs.js';
import { kinesisVideoStreamHelper } from '../KinesisVideoStreamHelper.js';

describe('KinesisVideoStreamHelper', () => {
  const mockKvsClient = mockClient(KinesisVideoClient);
  const testStreamArn = 'testStreamArn';

  beforeEach(() => {
    mockKvsClient.reset();
  });

  describe('createStream()', () => {
    it.each([JobType.EVALUATION, JobType.SUBMISSION, JobType.TRAINING])(
      'should create a kvs stream based on a given %s job name',
      async (jobType) => {
        const jobName = `deepracerindy-${jobType}-123` as JobName<typeof jobType>;

        mockKvsClient.on(CreateStreamCommand).resolves({ StreamARN: testStreamArn });

        const result = await kinesisVideoStreamHelper.createStream(jobName);

        expect(mockKvsClient).toHaveReceivedCommandWith(CreateStreamCommand, {
          StreamName: jobName,
          DataRetentionInHours: StreamDataRetentionInHours[jobType],
          MediaType: KVS_MEDIA_TYPE,
        });
        expect(result).toBe(testStreamArn);
      },
    );
  });

  describe('deleteStream()', () => {
    it('should delete the kinesis video stream with the given arn', async () => {
      mockKvsClient.on(DeleteStreamCommand).resolves({});

      await expect(kinesisVideoStreamHelper.deleteStream(testStreamArn)).resolves.toBeUndefined();
      expect(mockKvsClient).toHaveReceivedCommandWith(DeleteStreamCommand, { StreamARN: testStreamArn });
    });

    it('should not throw if the stream cannot be found', async () => {
      mockKvsClient
        .on(DeleteStreamCommand)
        .rejects(new ResourceNotFoundException({ message: 'Stream not found', $metadata: {} }));

      await expect(kinesisVideoStreamHelper.deleteStream(testStreamArn)).resolves.toBeUndefined();
      expect(mockKvsClient).toHaveReceivedCommandWith(DeleteStreamCommand, { StreamARN: testStreamArn });
    });
  });
});
