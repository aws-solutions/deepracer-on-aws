// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendMetricsData } from '../metricsSender.js';
import { MetricsSubscriptionKeyValue } from '../metricsTypes.js';

describe('metricsSender', () => {
  const mockFetch = vi.fn();
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
  global.fetch = mockFetch;

  const deploymentUuid = '12345678-1234-1234-1234-123456789012';
  const mockStackArn = `arn:aws:cloudformation:us-east-1:123456789012:stack/MyStack/${deploymentUuid}`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.STACK_ARN = mockStackArn;
    process.env.SOLUTION_ID = 'TEST_SOLUTION';
    process.env.SOLUTION_VERSION = '1.0.0';
    process.env.ACCOUNT_ID = '123456789012';
    process.env.REGION = 'us-east-1';
  });

  describe('UUID extraction from Stack ID', () => {
    it('should extract UUID from valid CloudFormation stack ARN', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.uuid).toBe(deploymentUuid);
    });

    it('should return UNKNOWN for stack ID without UUID part', async () => {
      const mockStackArnBad = 'arn:aws:cloudformation:us-east-1:123456789012:stack/MyStack';
      process.env.STACK_ARN = mockStackArnBad;

      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.uuid).toBe('UNKNOWN');
    });

    it('should fallback to UNKNOWN when STACK_ARN is empty', async () => {
      process.env.STACK_ARN = '';

      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.uuid).toBe('UNKNOWN');
    });

    it('should fallback to UNKNOWN when STACK_ARN is not set', async () => {
      delete process.env.STACK_ARN;

      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.uuid).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for malformed stack ARN', async () => {
      const mockStackArnBad = 'not-a-valid-arn';
      process.env.STACK_ARN = mockStackArnBad;

      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.uuid).toBe('UNKNOWN');
    });
  });

  describe('sendMetricsData', () => {
    it('should send metrics data with correct structure', async () => {
      const testData = {
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile-123',
      };

      await sendMetricsData(testData);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://metrics.awssolutionsbuilder.com/generic');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
      });

      const requestBody = JSON.parse(options.body);
      expect(requestBody).toMatchObject({
        timestamp: expect.any(String),
        solution: expect.any(String),
        version: expect.any(String),
        uuid: expect.any(String),
        event_name: MetricsSubscriptionKeyValue.USER_LOG_IN,
        context_version: 1,
        context: {
          profileId: 'test-profile-123',
          account: expect.any(String),
          region: expect.any(String),
        },
      });
    });

    it('should extract metricsLogSubscriptionKey from data and include it as event_name', async () => {
      const testData = {
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DEEP_RACER_JOB,
        jobType: 'TRAINING',
        jobStatus: 'COMPLETED',
        modelId: 'model-123',
        sageMakerMinutes: 45,
      };

      await sendMetricsData(testData);

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.event_name).toBe(MetricsSubscriptionKeyValue.DEEP_RACER_JOB);
      expect(requestBody.context).toEqual({
        jobType: 'TRAINING',
        jobStatus: 'COMPLETED',
        modelId: 'model-123',
        sageMakerMinutes: 45,
        account: expect.any(String),
        region: expect.any(String),
      });
      expect(requestBody.context.metricsLogSubscriptionKey).toBeUndefined();
    });

    it('should include a valid ISO timestamp', async () => {
      const beforeCall = new Date();

      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const afterCall = new Date();
      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);
      const timestamp = new Date(requestBody.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
      expect(requestBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should set context_version to 1', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.context_version).toBe(1);
    });

    it('should handle empty context data', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.CREATE_USER,
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.context).toEqual({
        account: expect.any(String),
        region: expect.any(String),
      });
      expect(requestBody.event_name).toBe(MetricsSubscriptionKeyValue.CREATE_USER);
    });

    it('should handle complex nested data in context', async () => {
      const complexData = {
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DEEP_RACER_JOB,
        jobType: 'EVALUATION',
        metadata: {
          track: 'reinvent_2018',
          parameters: {
            episodes: 100,
            batch_size: 64,
          },
        },
        tags: ['test', 'evaluation'],
      };

      await sendMetricsData(complexData);

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.context).toEqual({
        jobType: 'EVALUATION',
        metadata: {
          track: 'reinvent_2018',
          parameters: {
            episodes: 100,
            batch_size: 64,
          },
        },
        tags: ['test', 'evaluation'],
        account: expect.any(String),
        region: expect.any(String),
      });
    });

    it('should propagate fetch errors', async () => {
      const fetchError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(fetchError);

      const testData = {
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      };

      await expect(sendMetricsData(testData)).rejects.toThrow('Network error');
    });

    it('should handle fetch response errors gracefully', async () => {
      const errorResponse = { ok: false, status: 500, statusText: 'Internal Server Error' };
      mockFetch.mockResolvedValueOnce(errorResponse);
      const testData = {
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      };

      // The function doesn't check response status, so it should complete without throwing
      await expect(sendMetricsData(testData)).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use correct HTTP method and headers', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should handle all supported MetricsSubscriptionKeyValue types', async () => {
      const testCases = [
        {
          key: MetricsSubscriptionKeyValue.USER_LOG_IN,
          data: { profileId: 'test' },
        },
        {
          key: MetricsSubscriptionKeyValue.DAILY_HEART_BEAT,
          data: { models: 1, users: 1, races: 1, trainingJobs: 1, evaluationJobs: 1 },
        },
        {
          key: MetricsSubscriptionKeyValue.DEEP_RACER_JOB,
          data: { jobType: 'TRAINING', jobStatus: 'COMPLETED', modelId: 'test', sageMakerMinutes: 10 },
        },
        {
          key: MetricsSubscriptionKeyValue.CREATE_USER,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.IMPORT_MODEL,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.DOWNLOAD_MODEL,
          data: { modelId: 'test-model' },
        },
        {
          key: MetricsSubscriptionKeyValue.CREATE_EVALUATION,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.CREATE_LEADERBOARD,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.CREATE_MODEL,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.CREATE_SUBMISSION,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.DELETE_MODEL,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.DELETE_PROFILE,
          data: {},
        },
        {
          key: MetricsSubscriptionKeyValue.DELETE_PROFILE_MODELS,
          data: {},
        },
      ];

      for (const testCase of testCases) {
        await sendMetricsData({
          metricsLogSubscriptionKey: testCase.key,
          ...testCase.data,
        });

        const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const requestBody = JSON.parse(options.body);

        expect(requestBody.event_name).toBe(testCase.key);
        expect(requestBody.context).toEqual({
          ...testCase.data,
          account: expect.any(String),
          region: expect.any(String),
        });
      }

      expect(mockFetch).toHaveBeenCalledTimes(testCases.length);
    });

    it('should include solution metadata fields', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody).toHaveProperty('solution');
      expect(requestBody).toHaveProperty('version');
      expect(requestBody).toHaveProperty('uuid');
      expect(requestBody).toHaveProperty('timestamp');
      expect(requestBody).toHaveProperty('event_name');
      expect(requestBody).toHaveProperty('context_version');
      expect(requestBody).toHaveProperty('context');
      expect(requestBody.context).toHaveProperty('account');
      expect(requestBody.context).toHaveProperty('region');
    });

    it('should send to correct default endpoint', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://metrics.awssolutionsbuilder.com/generic');
    });

    it('should always include account and region in context', async () => {
      await sendMetricsData({
        metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.USER_LOG_IN,
        profileId: 'test-profile',
        customField: 'custom-value',
      });

      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      expect(requestBody.context).toHaveProperty('account');
      expect(requestBody.context).toHaveProperty('region');
      expect(requestBody.context).toHaveProperty('profileId', 'test-profile');
      expect(requestBody.context).toHaveProperty('customField', 'custom-value');

      expect(typeof requestBody.context.account).toBe('string');
      expect(typeof requestBody.context.region).toBe('string');
    });
  });
});
