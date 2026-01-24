// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { gzipSync } from 'zlib';

import { sendMetricsData, MetricsSubscriptionKeyValue } from '@deepracer-indy/utils';
import { metricsLogDataField } from '@deepracer-indy/utils/src/metrics/metricsLogger';
import { metricsLogSubscriptionKeyField } from '@deepracer-indy/utils/src/metrics/metricsTypes';
import type { CloudWatchLogsEvent, Context } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaHandler } from '../processSubscribedMetricsLogs.js';

vi.mock('@deepracer-indy/utils', async () => {
  const original = await vi.importActual('@deepracer-indy/utils');
  return {
    ...original,
    sendMetricsData: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('#utils/instrumentation/instrumentHandler.js', () => ({
  instrumentHandler: vi.fn((handler) => handler),
}));

describe('processSubscribedMetricsLogs', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const createCloudWatchLogsEvent = (
    logEvents: Array<{ id: string; timestamp: string; message: string }>,
  ): CloudWatchLogsEvent => {
    const logData = {
      messageType: 'DATA_MESSAGE',
      owner: '123456789012',
      logGroup: '/aws/lambda/test-function',
      logStream: '2023/01/01/[$LATEST]test-stream',
      subscriptionFilters: ['test-filter'],
      logEvents,
    };

    const compressedData = gzipSync(JSON.stringify(logData));
    const base64Data = compressedData.toString('base64');

    return {
      awslogs: {
        data: base64Data,
      },
    };
  };

  describe('lambdaHandler', () => {
    it('should process single log event successfully', async () => {
      const metricsData = {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile-123',
      };

      const logEntry = {
        [metricsLogDataField]: metricsData,
        timestamp: '2023-01-01T12:00:00.000Z',
        level: 'INFO',
        message: 'User logged in',
      };

      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: JSON.stringify(logEntry),
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);
      vi.mocked(sendMetricsData).mockResolvedValue(undefined);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).toHaveBeenCalledTimes(1);
      expect(sendMetricsData).toHaveBeenCalledWith(metricsData);
    });

    it('should process multiple log events successfully', async () => {
      const metricsData1 = {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'profile-1',
      };

      const metricsData2 = {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.CREATE_MODEL,
        modelId: 'model-123',
      };

      const metricsData3 = {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.DAILY_HEART_BEAT,
        models: 10,
        users: 5,
        races: 2,
        trainingJobs: 8,
        evaluationJobs: 3,
      };

      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: JSON.stringify({ [metricsLogDataField]: metricsData1 }),
        },
        {
          id: '2',
          timestamp: '1672574401000',
          message: JSON.stringify({ [metricsLogDataField]: metricsData2 }),
        },
        {
          id: '3',
          timestamp: '1672574402000',
          message: JSON.stringify({ [metricsLogDataField]: metricsData3 }),
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);
      vi.mocked(sendMetricsData).mockResolvedValue(undefined);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).toHaveBeenCalledTimes(3);
      expect(sendMetricsData).toHaveBeenNthCalledWith(1, metricsData1);
      expect(sendMetricsData).toHaveBeenNthCalledWith(2, metricsData2);
      expect(sendMetricsData).toHaveBeenNthCalledWith(3, metricsData3);
    });

    it('should handle empty log events array', async () => {
      const event = createCloudWatchLogsEvent([]);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).not.toHaveBeenCalled();
    });

    it('should handle log data without logEvents property', async () => {
      const logData = {
        messageType: 'DATA_MESSAGE',
        owner: '123456789012',
        logGroup: '/aws/lambda/test-function',
        logStream: '2023/01/01/[$LATEST]test-stream',
        subscriptionFilters: ['test-filter'],
        // No logEvents property
      };

      const compressedData = gzipSync(JSON.stringify(logData));
      const base64Data = compressedData.toString('base64');

      const event: CloudWatchLogsEvent = {
        awslogs: {
          data: base64Data,
        },
      };

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).not.toHaveBeenCalled();
    });

    it('should handle log data with non-array logEvents', async () => {
      const logData = {
        messageType: 'DATA_MESSAGE',
        owner: '123456789012',
        logGroup: '/aws/lambda/test-function',
        logStream: '2023/01/01/[$LATEST]test-stream',
        subscriptionFilters: ['test-filter'],
        logEvents: 'not-an-array' as never,
      };

      const compressedData = gzipSync(JSON.stringify(logData));
      const base64Data = compressedData.toString('base64');

      const event: CloudWatchLogsEvent = {
        awslogs: {
          data: base64Data,
        },
      };

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).not.toHaveBeenCalled();
    });

    it('should handle invalid base64 data', async () => {
      const event: CloudWatchLogsEvent = {
        awslogs: {
          data: 'invalid-base64-data!!!',
        },
      };

      await expect(lambdaHandler(event, mockContext)).rejects.toThrow();
    });

    it('should handle invalid compressed data', async () => {
      const invalidCompressedData = Buffer.from('invalid compressed data');
      const base64Data = invalidCompressedData.toString('base64');

      const event: CloudWatchLogsEvent = {
        awslogs: {
          data: base64Data,
        },
      };

      await expect(lambdaHandler(event, mockContext)).rejects.toThrow();
    });

    it('should handle invalid JSON in log data', async () => {
      const invalidJson = 'invalid json data';
      const compressedData = gzipSync(invalidJson);
      const base64Data = compressedData.toString('base64');

      const event: CloudWatchLogsEvent = {
        awslogs: {
          data: base64Data,
        },
      };

      await expect(lambdaHandler(event, mockContext)).rejects.toThrow();
    });

    it('should handle invalid JSON in log event message', async () => {
      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: 'invalid json message',
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).not.toHaveBeenCalled();
    });

    it('should handle missing metricsLogData field in log entry', async () => {
      const logEntry = {
        timestamp: '2023-01-01T12:00:00.000Z',
        level: 'INFO',
        message: 'Log without metrics data',
        // Missing metricsLogDataField
      };

      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: JSON.stringify(logEntry),
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).not.toHaveBeenCalled();
    });

    it('should handle sendMetricsData failure gracefully', async () => {
      const metricsData = {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      };

      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: JSON.stringify({ [metricsLogDataField]: metricsData }),
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);
      const sendError = new Error('Failed to send metrics');
      vi.mocked(sendMetricsData).mockRejectedValue(sendError);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).toHaveBeenCalledTimes(1);
      expect(sendMetricsData).toHaveBeenCalledWith(metricsData);
    });

    it('should process complex metrics data correctly', async () => {
      const complexMetricsData = {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.DEEP_RACER_JOB,
        jobType: 'TRAINING',
        jobStatus: 'COMPLETED',
        modelId: 'model-abc-123',
        sageMakerMinutes: 45,
        metadata: {
          track: 'reinvent_2018',
          parameters: {
            episodes: 100,
            batch_size: 64,
          },
        },
        tags: ['test', 'training'],
      };

      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: JSON.stringify({ [metricsLogDataField]: complexMetricsData }),
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);
      vi.mocked(sendMetricsData).mockResolvedValue(undefined);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).toHaveBeenCalledWith(complexMetricsData);
    });

    it('should handle log events with different structures', async () => {
      const logEvents = [
        {
          id: '1',
          timestamp: '1672574400000',
          message: JSON.stringify({
            [metricsLogDataField]: {
              [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
              profileId: 'user-1',
            },
            level: 'INFO',
            timestamp: '2023-01-01T12:00:00.000Z',
          }),
        },
        {
          id: '2',
          timestamp: '1672574401000',
          message: JSON.stringify({
            [metricsLogDataField]: {
              [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.CREATE_MODEL,
            },
            requestId: 'req-123',
            duration: 1500,
          }),
        },
      ];

      const event = createCloudWatchLogsEvent(logEvents);
      vi.mocked(sendMetricsData).mockResolvedValue(undefined);

      await lambdaHandler(event, mockContext);

      expect(sendMetricsData).toHaveBeenCalledTimes(2);
      expect(sendMetricsData).toHaveBeenNthCalledWith(1, {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'user-1',
      });
      expect(sendMetricsData).toHaveBeenNthCalledWith(2, {
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.CREATE_MODEL,
      });
    });

    describe('subscription key validation', () => {
      it('should process metrics data with valid subscription key', async () => {
        const metricsData = {
          [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.IMPORT_MODEL,
          modelId: 'imported-model-123',
        };

        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: metricsData }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);
        vi.mocked(sendMetricsData).mockResolvedValue(undefined);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).toHaveBeenCalledTimes(1);
        expect(sendMetricsData).toHaveBeenCalledWith(metricsData);
      });

      it('should skip metrics data with invalid subscription key', async () => {
        const metricsData = {
          [metricsLogSubscriptionKeyField]: 'INVALID_KEY',
          someData: 'test-data',
        };

        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: metricsData }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).not.toHaveBeenCalled();
      });

      it('should skip metrics data without subscription key field', async () => {
        const metricsData = {
          // Missing metricsLogSubscriptionKey field
          profileId: 'test-profile',
          action: 'some-action',
        };

        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: metricsData }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).not.toHaveBeenCalled();
      });

      it('should skip non-object metrics data', async () => {
        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: 'string-data' }),
          },
          {
            id: '2',
            timestamp: '1672574401000',
            message: JSON.stringify({ [metricsLogDataField]: 123 }),
          },
          {
            id: '3',
            timestamp: '1672574402000',
            message: JSON.stringify({ [metricsLogDataField]: null }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).not.toHaveBeenCalled();
      });

      it('should process all valid enum subscription keys', async () => {
        const validKeys = Object.values(MetricsSubscriptionKeyValue);
        const logEvents = validKeys.map((key, index) => ({
          id: `${index + 1}`,
          timestamp: `${1672574400000 + index}`,
          message: JSON.stringify({
            [metricsLogDataField]: {
              [metricsLogSubscriptionKeyField]: key,
              testData: `data-for-${key}`,
            },
          }),
        }));

        const event = createCloudWatchLogsEvent(logEvents);
        vi.mocked(sendMetricsData).mockResolvedValue(undefined);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).toHaveBeenCalledTimes(validKeys.length);

        validKeys.forEach((key, index) => {
          expect(sendMetricsData).toHaveBeenNthCalledWith(index + 1, {
            [metricsLogSubscriptionKeyField]: key,
            testData: `data-for-${key}`,
          });
        });
      });

      it('should handle mixed valid and invalid subscription keys', async () => {
        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({
              [metricsLogDataField]: {
                [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
                profileId: 'valid-user',
              },
            }),
          },
          {
            id: '2',
            timestamp: '1672574401000',
            message: JSON.stringify({
              [metricsLogDataField]: {
                [metricsLogSubscriptionKeyField]: 'INVALID_KEY',
                someData: 'invalid-data',
              },
            }),
          },
          {
            id: '3',
            timestamp: '1672574402000',
            message: JSON.stringify({
              [metricsLogDataField]: {
                [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.CREATE_MODEL,
                modelId: 'valid-model',
              },
            }),
          },
          {
            id: '4',
            timestamp: '1672574403000',
            message: JSON.stringify({
              [metricsLogDataField]: {
                // Missing subscription key
                data: 'no-key-data',
              },
            }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);
        vi.mocked(sendMetricsData).mockResolvedValue(undefined);

        await lambdaHandler(event, mockContext);

        // Should only process the 2 valid events
        expect(sendMetricsData).toHaveBeenCalledTimes(2);
        expect(sendMetricsData).toHaveBeenNthCalledWith(1, {
          [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.USER_LOG_IN,
          profileId: 'valid-user',
        });
        expect(sendMetricsData).toHaveBeenNthCalledWith(2, {
          [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.CREATE_MODEL,
          modelId: 'valid-model',
        });
      });

      it('should handle subscription key with null value', async () => {
        const metricsData = {
          [metricsLogSubscriptionKeyField]: null,
          someData: 'test-data',
        };

        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: metricsData }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).not.toHaveBeenCalled();
      });

      it('should handle subscription key with undefined value', async () => {
        const metricsData = {
          [metricsLogSubscriptionKeyField]: undefined,
          someData: 'test-data',
        };

        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: metricsData }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).not.toHaveBeenCalled();
      });

      it('should handle empty string subscription key', async () => {
        const metricsData = {
          [metricsLogSubscriptionKeyField]: '',
          someData: 'test-data',
        };

        const logEvents = [
          {
            id: '1',
            timestamp: '1672574400000',
            message: JSON.stringify({ [metricsLogDataField]: metricsData }),
          },
        ];

        const event = createCloudWatchLogsEvent(logEvents);

        await lambdaHandler(event, mockContext);

        expect(sendMetricsData).not.toHaveBeenCalled();
      });
    });
  });
});
