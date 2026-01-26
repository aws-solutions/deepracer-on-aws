// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { logger, s3Helper } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, vi } from 'vitest';

import { cloudWatchLogsClient } from '../clients/cloudWatchLogsClient.js';
import { cloudWatchLogsHelper, LogEventsReadableStream } from '../CloudWatchLogsHelper.js';

vi.mock('@deepracer-indy/utils', async (importOriginal) => ({
  ...(await importOriginal()),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  s3Helper: {
    writeToS3: vi.fn(),
  },
  logMethod: vi.fn((_target, _propertyKey, descriptor) => descriptor),
}));

describe('CloudWatchLogsHelper', () => {
  const mockCloudWatchLogsClient = mockClient(cloudWatchLogsClient);
  const mockLogGroupName = 'test-log-group';
  const mockLogStreamPrefix = 'test-stream-prefix';
  const mockS3Location = 's3://test-bucket/test-key';
  const mockLogStreamName = `${mockLogStreamPrefix}-test-stream`;
  const mockLogEvents1 = [{ message: 'Log message 1' }, { message: 'Log message 2' }];
  const mockLogEvents2 = [{ message: 'Log message 3' }, { message: 'Log message 4' }];
  const mockNextToken = 'mock-next-token';

  beforeEach(() => {
    mockCloudWatchLogsClient.reset();
  });

  describe('writeLogStreamToS3', () => {
    it('should successfully upload logs to S3', async () => {
      mockCloudWatchLogsClient.on(DescribeLogStreamsCommand).resolvesOnce({
        logStreams: [{ logStreamName: mockLogStreamName }],
      });

      await cloudWatchLogsHelper.writeLogStreamToS3(mockLogGroupName, mockLogStreamPrefix, mockS3Location);

      expect(mockCloudWatchLogsClient).toHaveReceivedCommandWith(DescribeLogStreamsCommand, {
        logStreamNamePrefix: mockLogStreamPrefix,
        logGroupName: mockLogGroupName,
      });

      expect(s3Helper.writeToS3).toHaveBeenCalledWith(expect.any(LogEventsReadableStream), mockS3Location);
    });

    it('should handle no log stream found', async () => {
      mockCloudWatchLogsClient.on(DescribeLogStreamsCommand).resolves({
        logStreams: [],
      });

      await expect(
        cloudWatchLogsHelper.writeLogStreamToS3(mockLogGroupName, mockLogStreamPrefix, mockS3Location),
      ).rejects.toThrow();

      expect(s3Helper.writeToS3).not.toHaveBeenCalled();
    });

    it('should handle CloudWatch API errors', async () => {
      const mockError = new Error('CloudWatch API error');
      mockCloudWatchLogsClient.on(DescribeLogStreamsCommand).rejectsOnce(mockError);

      await expect(
        cloudWatchLogsHelper.writeLogStreamToS3(mockLogGroupName, mockLogStreamPrefix, mockS3Location),
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith('Failed to write log messages to S3.', { error: mockError });
      expect(s3Helper.writeToS3).not.toHaveBeenCalled();
    });

    it('should handle S3 upload errors', async () => {
      const mockError = new Error('S3 upload error');

      mockCloudWatchLogsClient.on(DescribeLogStreamsCommand).resolvesOnce({
        logStreams: [{ logStreamName: mockLogStreamName }],
      });

      vi.mocked(s3Helper.writeToS3).mockRejectedValueOnce(mockError);

      await expect(
        cloudWatchLogsHelper.writeLogStreamToS3(mockLogGroupName, mockLogStreamPrefix, mockS3Location),
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith('Failed to write log messages to S3.', { error: mockError });
    });
  });

  describe('LogEventsReadableStream', () => {
    it('should read log events and push to stream', async () => {
      mockCloudWatchLogsClient
        .on(GetLogEventsCommand)
        .resolvesOnce({
          events: mockLogEvents1,
          nextForwardToken: mockNextToken,
        })
        .resolvesOnce({
          events: mockLogEvents2,
          nextForwardToken: mockNextToken,
        })
        .resolvesOnce({ events: [] });

      const stream = new LogEventsReadableStream(mockLogGroupName, mockLogStreamName);

      const pushSpy = vi.spyOn(stream, 'push');

      await stream.read();

      expect(mockCloudWatchLogsClient).toHaveReceivedNthCommandWith(GetLogEventsCommand, 1, {
        logGroupName: mockLogGroupName,
        logStreamName: mockLogStreamName,
        startFromHead: true,
      });

      await stream.read();

      expect(pushSpy).toHaveBeenCalledWith('Log message 1\nLog message 2\n');

      expect(mockCloudWatchLogsClient).toHaveReceivedNthCommandWith(GetLogEventsCommand, 2, {
        logGroupName: mockLogGroupName,
        logStreamName: mockLogStreamName,
        nextToken: mockNextToken,
        startFromHead: true,
      });
      expect(pushSpy).toHaveBeenCalledWith('Log message 3\nLog message 4\n');

      await stream.read();

      expect(mockCloudWatchLogsClient).toHaveReceivedNthCommandWith(GetLogEventsCommand, 3, {
        logGroupName: mockLogGroupName,
        logStreamName: mockLogStreamName,
        nextToken: mockNextToken,
        startFromHead: true,
      });

      expect(pushSpy).toHaveBeenCalledWith(null);
    });

    it('should end stream when no log events found', async () => {
      const stream = new LogEventsReadableStream(mockLogGroupName, mockLogStreamName);

      mockCloudWatchLogsClient.on(GetLogEventsCommand).resolvesOnce({
        events: [],
      });

      const pushSpy = vi.spyOn(stream, 'push');

      await stream.read();

      expect(pushSpy).toHaveBeenCalledWith(null);
    });

    it('should handle API errors and destroy stream', async () => {
      const mockError = new Error('API error');
      const stream = new LogEventsReadableStream(mockLogGroupName, mockLogStreamName);
      const destroySpy = vi.spyOn(stream, 'destroy');

      stream.on('error', (error) => {
        expect(error).toEqual(mockError);
      });

      mockCloudWatchLogsClient.on(GetLogEventsCommand).rejectsOnce(mockError);

      await stream.read();

      expect(logger.error).toHaveBeenCalledWith('Error getting log events', { error: mockError });
      expect(destroySpy).toHaveBeenCalledWith(mockError);
    });
  });
});
