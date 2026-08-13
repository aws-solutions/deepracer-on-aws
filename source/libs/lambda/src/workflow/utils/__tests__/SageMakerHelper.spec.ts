// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateTrainingJobCommand,
  DescribeTrainingJobCommandOutput,
  ListTrainingJobsCommand,
  SageMakerClient,
  StopTrainingJobCommand,
  TrainingJobStatus,
} from '@aws-sdk/client-sagemaker';
import { TEST_TRAINING_ITEM, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SageMakerHyperparameters } from '../../types/sageMakerHyperparameters.js';
import { sageMakerHelper } from '../SageMakerHelper.js';

describe('SageMakerHelper', () => {
  const mockSageMakerClient = mockClient(SageMakerClient);
  const testTrainingJobArn = 'testTrainingJobArn';

  beforeEach(() => {
    mockSageMakerClient.reset();
    // Set required environment variables
    process.env.SAGEMAKER_TRAINING_IMAGE =
      '123456789012.dkr.ecr.us-east-1.amazonaws.com/deepracer-on-aws-sim-app:latest';
  });

  describe('createTrainingJob()', () => {
    it('should create a sagemaker training job based on the given jobItem and modelItem', async () => {
      const spyOnGetSageMakerHyperparameters = vi
        .spyOn(sageMakerHelper, 'getSageMakerHyperparameters')
        .mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient
        .on(CreateTrainingJobCommand, {
          TrainingJobName: TEST_TRAINING_ITEM.name,
          OutputDataConfig: {
            S3OutputPath: TEST_MODEL_ITEM.assetS3Locations.sageMakerArtifactsS3Location,
          },
          StoppingCondition: {
            MaxRuntimeInSeconds: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes * 60,
          },
          HyperParameters: {},
        })
        .resolves({ TrainingJobArn: testTrainingJobArn });

      await expect(
        sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM }),
      ).resolves.toBe(testTrainingJobArn);
      expect(spyOnGetSageMakerHyperparameters).toHaveBeenCalledWith(TEST_TRAINING_ITEM, TEST_MODEL_ITEM);
    });

    it('should use SAGEMAKER_INSTANCE_TYPE from env var when set', async () => {
      process.env.SAGEMAKER_INSTANCE_TYPE = 'ml.g4dn.2xlarge';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.ResourceConfig?.InstanceType).toBe('ml.g4dn.2xlarge');

      delete process.env.SAGEMAKER_INSTANCE_TYPE;
    });

    it('should enable RemoteDebugConfig when DEPLOYMENT_MODE is dev', async () => {
      process.env.DEPLOYMENT_MODE = 'dev';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.RemoteDebugConfig?.EnableRemoteDebug).toBe(true);

      delete process.env.DEPLOYMENT_MODE;
    });

    it('should disable RemoteDebugConfig when DEPLOYMENT_MODE is not dev', async () => {
      process.env.DEPLOYMENT_MODE = 'prod';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.RemoteDebugConfig?.EnableRemoteDebug).toBe(false);

      delete process.env.DEPLOYMENT_MODE;
    });

    it('should include KeepAlivePeriodInSeconds for live race jobs', async () => {
      const liveJobItem = {
        ...TEST_TRAINING_ITEM,
        name: 'deepracerindy-submission-abc123-live-def456',
      } as unknown as typeof TEST_TRAINING_ITEM;

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: liveJobItem, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls[0].args[0].input.ResourceConfig?.KeepAlivePeriodInSeconds).toBe(3600);
    });

    it('should not include KeepAlivePeriodInSeconds for non-live jobs', async () => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls[0].args[0].input.ResourceConfig?.KeepAlivePeriodInSeconds).toBeUndefined();
    });
  });

  describe('stopQueuedJob()', () => {
    const testJobName = TEST_TRAINING_ITEM.name;

    it('should stop job when it transitions from not-found to IN_PROGRESS', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob')
        .mockRejectedValueOnce(new Error('Job not found'))
        .mockResolvedValueOnce({
          TrainingJobStatus: TrainingJobStatus.IN_PROGRESS,
          $metadata: {},
        } as Partial<DescribeTrainingJobCommandOutput> as DescribeTrainingJobCommandOutput);

      mockSageMakerClient.on(StopTrainingJobCommand).resolves({});

      await sageMakerHelper.stopQueuedJob(testJobName, 10000, 100);

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(1);
    });

    it('should not stop job if already in terminal state', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.COMPLETED,
        $metadata: {},
      } as Partial<DescribeTrainingJobCommandOutput> as DescribeTrainingJobCommandOutput);

      await sageMakerHelper.stopQueuedJob(testJobName, 10000, 100);

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(0);
    });

    it('should throw InternalFailureError if job does not start within timeout period', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockRejectedValue(new Error('Job not found'));

      await expect(sageMakerHelper.stopQueuedJob(testJobName, 500, 100)).rejects.toThrow(
        'Failed to cancel job. Please check with your administrator',
      );

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(0);
    });

    it('should throw InternalFailureError when timeout is reached and job is still pending', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValue({
        TrainingJobStatus: TrainingJobStatus.STOPPING,
        $metadata: {},
      } as Partial<DescribeTrainingJobCommandOutput> as DescribeTrainingJobCommandOutput);

      await expect(sageMakerHelper.stopQueuedJob(testJobName, 300, 100)).rejects.toThrow(
        'Failed to cancel job. Please check with your administrator',
      );

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(0);
    });
  });
  describe('isTrainingInstanceCapacityAvailable()', () => {
    const QUOTA = 4;

    /**
     * The quota and usage caches are module-level state, so each test imports a fresh
     * copy of the module to start from an empty cache.
     */
    const importFreshHelper = async () => {
      vi.resetModules();
      const module = await import('../SageMakerHelper.js');
      return module.sageMakerHelper;
    };

    const mockQuota = async (value = QUOTA) => {
      const { serviceQuotasHelper } = await import('../ServiceQuotasHelper.js');
      return vi.spyOn(serviceQuotasHelper, 'getServiceQuota').mockResolvedValue({ Value: value });
    };

    /** Mocks ListTrainingJobs so that it reports `count` in-progress jobs on a single page. */
    const mockInProgressJobs = (count: number) => {
      mockSageMakerClient.on(ListTrainingJobsCommand).resolves({
        TrainingJobSummaries: Array.from({ length: count }, (_, index) => ({
          TrainingJobName: `deepracerindy-job-${index}`,
        })),
        NextToken: undefined,
      });
    };

    beforeEach(() => {
      vi.restoreAllMocks();
      mockSageMakerClient.reset();
    });

    it('should request the maximum page size to limit the number of ListTrainingJobs calls', async () => {
      const helper = await importFreshHelper();
      await mockQuota();
      mockInProgressJobs(1);

      await helper.isTrainingInstanceCapacityAvailable();

      const calls = mockSageMakerClient.commandCalls(ListTrainingJobsCommand);
      expect(calls.length).toBeGreaterThan(0);
      calls.forEach((call) => {
        expect(call.args[0].input.MaxResults).toBe(100);
      });
    });

    it('should return true when usage is below the quota', async () => {
      const helper = await importFreshHelper();
      await mockQuota();
      mockInProgressJobs(1);

      await expect(helper.isTrainingInstanceCapacityAvailable()).resolves.toBe(true);
    });

    it('should return false when usage has reached the quota', async () => {
      const helper = await importFreshHelper();
      await mockQuota(2);
      // Both the IN_PROGRESS and the STOPPING query resolve to one job each.
      mockInProgressJobs(1);

      await expect(helper.isTrainingInstanceCapacityAvailable()).resolves.toBe(false);
    });

    it('should cache the quota lookup between consecutive checks', async () => {
      const helper = await importFreshHelper();
      const getServiceQuota = await mockQuota();
      mockInProgressJobs(1);

      await helper.isTrainingInstanceCapacityAvailable();
      await helper.isTrainingInstanceCapacityAvailable();

      expect(getServiceQuota).toHaveBeenCalledTimes(1);
    });

    it('should cache the usage lookup so a second check issues no further ListTrainingJobs calls', async () => {
      const helper = await importFreshHelper();
      await mockQuota(10);
      mockInProgressJobs(1);

      await helper.isTrainingInstanceCapacityAvailable();
      const callsAfterFirstCheck = mockSageMakerClient.commandCalls(ListTrainingJobsCommand).length;

      await helper.isTrainingInstanceCapacityAvailable();

      expect(mockSageMakerClient.commandCalls(ListTrainingJobsCommand)).toHaveLength(callsAfterFirstCheck);
    });

    it('should optimistically increment cached usage so consecutive dispatches cannot exceed the quota', async () => {
      const helper = await importFreshHelper();
      // Quota of 3 with two jobs already running (one IN_PROGRESS, one STOPPING).
      await mockQuota(3);
      mockInProgressJobs(1);

      // First check sees usage 2 < 3 and increments the cached usage to 3.
      await expect(helper.isTrainingInstanceCapacityAvailable()).resolves.toBe(true);
      // Second check must observe the incremented value instead of the stale usage.
      await expect(helper.isTrainingInstanceCapacityAvailable()).resolves.toBe(false);
    });

    it('should clear the usage cache when no capacity is available', async () => {
      const helper = await importFreshHelper();
      await mockQuota(2);
      mockInProgressJobs(1);

      await expect(helper.isTrainingInstanceCapacityAvailable()).resolves.toBe(false);
      const callsAfterFirstCheck = mockSageMakerClient.commandCalls(ListTrainingJobsCommand).length;

      // The cache was cleared, so the next check must query the real usage again rather
      // than staying stuck believing the account is at capacity.
      await helper.isTrainingInstanceCapacityAvailable();

      expect(mockSageMakerClient.commandCalls(ListTrainingJobsCommand).length).toBeGreaterThan(
        callsAfterFirstCheck,
      );
    });
  });
});
