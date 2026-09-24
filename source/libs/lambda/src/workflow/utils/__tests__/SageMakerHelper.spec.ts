// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateTrainingJobCommand,
  DescribeTrainingJobCommand,
  DescribeTrainingJobCommandOutput,
  ListTrainingJobsCommand,
  SageMakerClient,
  StopTrainingJobCommand,
  TrainingInstanceType,
  TrainingJobStatus,
  type TrainingJobSummary,
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
        sageMakerHelper.createTrainingJob({
          jobItem: TEST_TRAINING_ITEM,
          modelItem: TEST_MODEL_ITEM,
          client: mockSageMakerClient as never,
        }),
      ).resolves.toBe(testTrainingJobArn);
      expect(spyOnGetSageMakerHyperparameters).toHaveBeenCalledWith(TEST_TRAINING_ITEM, TEST_MODEL_ITEM);
    });

    it('should use SAGEMAKER_INSTANCE_TYPE from env var when set', async () => {
      process.env.SAGEMAKER_INSTANCE_TYPE = 'ml.g4dn.2xlarge';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.ResourceConfig?.InstanceType).toBe('ml.g4dn.2xlarge');

      delete process.env.SAGEMAKER_INSTANCE_TYPE;
    });

    it('should enable RemoteDebugConfig when DEPLOYMENT_MODE is dev', async () => {
      process.env.DEPLOYMENT_MODE = 'dev';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.RemoteDebugConfig?.EnableRemoteDebug).toBe(true);

      delete process.env.DEPLOYMENT_MODE;
    });

    it('should disable RemoteDebugConfig when DEPLOYMENT_MODE is not dev', async () => {
      process.env.DEPLOYMENT_MODE = 'prod';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

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

      await sageMakerHelper.createTrainingJob({
        jobItem: liveJobItem,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls[0].args[0].input.ResourceConfig?.KeepAlivePeriodInSeconds).toBe(3600);
    });

    it('should not include KeepAlivePeriodInSeconds for non-live jobs', async () => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls[0].args[0].input.ResourceConfig?.KeepAlivePeriodInSeconds).toBeUndefined();
    });

    it('should always include SessionChainingConfig with EnableSessionTagChaining true', async () => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls[0].args[0].input.SessionChainingConfig).toEqual({ EnableSessionTagChaining: true });
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

  describe('checkTrainingCapacity()', () => {
    const DEFAULT_INSTANCE_TYPE = 'ml.c7i.4xlarge';
    const INSTANCE_TYPE_QUOTA_CODE = 'L-1EC4D7FD'; // ml.c7i.4xlarge
    const TOTAL_INSTANCE_QUOTA_CODE = 'L-00C91CB5';

    /**
     * The quota and usage caches are module-level state, so each test imports a fresh
     * copy of the module to start from an empty cache.
     */
    const importFreshHelper = async () => {
      vi.resetModules();
      const module = await import('../SageMakerHelper.js');
      return module.sageMakerHelper;
    };

    /** Mocks each quota code independently so either quota can be the limiting one. */
    const mockQuotas = async ({ instanceType, total }: { instanceType: number; total: number }) => {
      const { serviceQuotasHelper } = await import('../ServiceQuotasHelper.js');
      return vi
        .spyOn(serviceQuotasHelper, 'getServiceQuota')
        .mockImplementation(async (_serviceCode: string, quotaCode: string) => ({
          Value: quotaCode === TOTAL_INSTANCE_QUOTA_CODE ? total : instanceType,
        }));
    };

    /**
     * Mocks the active-job listing and each job's ResourceConfig. Usage is measured in instance
     * units, so every job carries its own instance type and count.
     */
    const mockActiveJobs = (jobs: { name: string; instanceType: string; instanceCount: number }[]) => {
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.IN_PROGRESS })
        .resolves({
          TrainingJobSummaries: jobs.map(({ name }) => ({ TrainingJobName: name }) as TrainingJobSummary),
          NextToken: undefined,
        })
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.STOPPING })
        .resolves({ TrainingJobSummaries: [], NextToken: undefined });

      jobs.forEach(({ name, instanceType, instanceCount }) => {
        mockSageMakerClient.on(DescribeTrainingJobCommand, { TrainingJobName: name }).resolves({
          ResourceConfig: {
            // ml.c7i.4xlarge is a valid SageMaker instance type but is missing from the installed
            // @aws-sdk/client-sagemaker type definitions.
            InstanceType: instanceType as TrainingInstanceType,
            InstanceCount: instanceCount,
            VolumeSizeInGB: 100,
          },
        });
      });
    };

    beforeEach(() => {
      vi.restoreAllMocks();
      mockSageMakerClient.reset();
      delete process.env.SAGEMAKER_INSTANCE_TYPE;
    });

    it('should report AVAILABLE when both quotas have room', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toEqual({
        status: 'AVAILABLE',
        effectiveInstanceType: DEFAULT_INSTANCE_TYPE,
        requiredInstanceCount: 1,
      });
    });

    it('should request the maximum page size to limit the number of ListTrainingJobs calls', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 }]);

      await helper.checkTrainingCapacity();

      const calls = mockSageMakerClient.commandCalls(ListTrainingJobsCommand);
      expect(calls.length).toBeGreaterThan(0);
      calls.forEach((call) => {
        expect(call.args[0].input.MaxResults).toBe(100);
      });
    });

    it('should report UNAVAILABLE with INSTANCE_TYPE_QUOTA when the instance-type quota is exhausted', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 2, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 2 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'INSTANCE_TYPE_QUOTA',
      });
    });

    it('should report AVAILABLE when usage plus the new job lands exactly on the instance-type quota', async () => {
      // Quota 8, 7 already in use, 1 required: 7 + 1 = 8, which fits exactly and must not be rejected.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 8, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 7 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
    });

    it('should report UNAVAILABLE once usage plus the new job would exceed the instance-type quota', async () => {
      // Quota 8, 8 already in use, 1 required: 8 + 1 = 9 exceeds the quota of 8.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 8, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 8 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'INSTANCE_TYPE_QUOTA',
      });
    });

    it('should report UNAVAILABLE with TOTAL_INSTANCE_QUOTA when only the account-wide quota is exhausted', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 2 });
      // Instances of another type consume the account-wide quota without touching the type quota.
      mockActiveJobs([{ name: 'job-other', instanceType: 'ml.g4dn.xlarge', instanceCount: 2 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'TOTAL_INSTANCE_QUOTA',
      });
    });

    it('should report AVAILABLE when usage plus the new job lands exactly on the total-instance quota', async () => {
      // Total quota 30, 29 already in use (of another type), 1 required: 29 + 1 = 30 fits exactly.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 100, total: 30 });
      mockActiveJobs([{ name: 'job-other', instanceType: 'ml.g4dn.xlarge', instanceCount: 29 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
    });

    it('should count instances rather than jobs', async () => {
      const helper = await importFreshHelper();
      // One job holding 4 instances fills a quota of 4 even though it is a single job.
      await mockQuotas({ instanceType: 4, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 4 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'INSTANCE_TYPE_QUOTA',
      });
    });

    it('should count training jobs this solution did not create', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 100, total: 2 });
      mockActiveJobs([{ name: 'customer-owned-job', instanceType: 'ml.m5.xlarge', instanceCount: 2 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNAVAILABLE' });

      // The listing must not be scoped to the deepracerindy- prefix, or external usage is invisible.
      mockSageMakerClient.commandCalls(ListTrainingJobsCommand).forEach((call) => {
        expect(call.args[0].input.NameContains).toBeUndefined();
      });
    });

    it('should resolve the quota for the SAGEMAKER_INSTANCE_TYPE override', async () => {
      process.env.SAGEMAKER_INSTANCE_TYPE = 'ml.g4dn.2xlarge';
      const helper = await importFreshHelper();
      const getServiceQuota = await mockQuotas({ instanceType: 4, total: 10 });
      mockActiveJobs([]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'AVAILABLE',
        effectiveInstanceType: 'ml.g4dn.2xlarge',
      });
      expect(getServiceQuota).toHaveBeenCalledWith('sagemaker', 'L-C2495BC4'); // ml.g4dn.2xlarge
      expect(getServiceQuota).not.toHaveBeenCalledWith('sagemaker', INSTANCE_TYPE_QUOTA_CODE);
    });

    it('should report UNKNOWN when a quota lookup fails', async () => {
      const helper = await importFreshHelper();
      const { serviceQuotasHelper } = await import('../ServiceQuotasHelper.js');
      vi.spyOn(serviceQuotasHelper, 'getServiceQuota').mockRejectedValue(new Error('AccessDenied'));
      mockActiveJobs([]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNKNOWN' });
    });

    it('should report UNKNOWN rather than AVAILABLE when a quota response has no value', async () => {
      const helper = await importFreshHelper();
      const { serviceQuotasHelper } = await import('../ServiceQuotasHelper.js');
      // ServiceQuota.Value is optional. Coerced to a number it would be `undefined`, and every
      // `required + usage >= undefined` comparison is false — which would fall through to AVAILABLE
      // and dispatch against an unknown quota.
      vi.spyOn(serviceQuotasHelper, 'getServiceQuota').mockResolvedValue({});
      mockActiveJobs([]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNKNOWN' });
    });

    it('should report UNKNOWN when a quota value is not finite', async () => {
      const helper = await importFreshHelper();
      const { serviceQuotasHelper } = await import('../ServiceQuotasHelper.js');
      vi.spyOn(serviceQuotasHelper, 'getServiceQuota').mockResolvedValue({ Value: Number.NaN });
      mockActiveJobs([]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNKNOWN' });
    });

    it('should report UNKNOWN when the effective instance type has no known quota code', async () => {
      process.env.SAGEMAKER_INSTANCE_TYPE = 'ml.unknown.type';
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNKNOWN' });
    });

    it('should cache the quota lookups between consecutive checks', async () => {
      const helper = await importFreshHelper();
      const getServiceQuota = await mockQuotas({ instanceType: 10, total: 20 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 }]);

      await helper.checkTrainingCapacity();
      await helper.checkTrainingCapacity();

      // One call per quota code, not per check.
      expect(getServiceQuota).toHaveBeenCalledTimes(2);
    });

    it('should cache the usage lookup so a second check issues no further ListTrainingJobs calls', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 10, total: 20 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 }]);

      await helper.checkTrainingCapacity();
      const callsAfterFirstCheck = mockSageMakerClient.commandCalls(ListTrainingJobsCommand).length;

      await helper.checkTrainingCapacity();

      expect(mockSageMakerClient.commandCalls(ListTrainingJobsCommand)).toHaveLength(callsAfterFirstCheck);
    });

    it('should optimistically increment cached usage so consecutive checks cannot both exceed the quota', async () => {
      const helper = await importFreshHelper();
      // Instance-type quota of 3, two instances already in use (1 in-progress + 1 stopping).
      await mockQuotas({ instanceType: 3, total: 100 });
      mockActiveJobs([
        { name: 'job-in-progress', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 },
        { name: 'job-stopping', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 },
      ]);

      // First check sees usage 2, required 1: 2 + 1 = 3 fits exactly and is AVAILABLE.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
      // Second check within the usage-cache TTL must observe the incremented usage (3), not the
      // stale pre-dispatch usage (2) that ListTrainingJobs would still eventually-consistently
      // report — otherwise both checks pass and the account is over-dispatched past the quota.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'INSTANCE_TYPE_QUOTA',
      });
    });

    it('should increment both the effective-type and total-instance cached usage on a successful check', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 100, total: 3 });
      mockActiveJobs([
        { name: 'job-in-progress', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 },
        { name: 'job-stopping', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 },
      ]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
      // The account-wide quota must reflect the same optimistic increment as the type quota.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'TOTAL_INSTANCE_QUOTA',
      });
    });

    it('should not increment cached usage when capacity is unavailable, to avoid double-counting the rejected job', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 2, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 2 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNAVAILABLE' });
      // A second check within the TTL must see the same usage (2), not an incremented value from
      // the rejected first check, or a job could remain blocked past when capacity actually frees.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'INSTANCE_TYPE_QUOTA',
      });
      expect(mockSageMakerClient.commandCalls(ListTrainingJobsCommand)).toHaveLength(2);
    });

    it('should not increment cached usage once the usage-cache entry has expired', async () => {
      vi.useFakeTimers();
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 3, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 2 }]);

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });

      // Past the 10s usage-cache TTL: the next check must re-read from ListTrainingJobs (still
      // reporting the same 2 active instances) rather than an optimistically-incremented value.
      vi.advanceTimersByTime(11_000);
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });

      vi.useRealTimers();
    });

    it('should report UNKNOWN rather than fail open when an active job cannot be described', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.IN_PROGRESS })
        .resolves({ TrainingJobSummaries: [{ TrainingJobName: 'vanished-job' } as TrainingJobSummary] })
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.STOPPING })
        .resolves({ TrainingJobSummaries: [] })
        .on(DescribeTrainingJobCommand)
        .rejects(new Error('ValidationException'));

      // A failed describe is indistinguishable here from a systemic problem (throttling, a missing
      // IAM permission), so it must not silently contribute 0 instances and produce a false
      // AVAILABLE — the caller must fail closed per the capacity-check contract.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNKNOWN' });
    });

    it('should report UNKNOWN when only some active jobs fail to describe', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.IN_PROGRESS })
        .resolves({
          TrainingJobSummaries: [
            { TrainingJobName: 'describable-job' },
            { TrainingJobName: 'throttled-job' },
          ] as TrainingJobSummary[],
        })
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.STOPPING })
        .resolves({ TrainingJobSummaries: [] })
        .on(DescribeTrainingJobCommand, { TrainingJobName: 'describable-job' })
        .resolves({
          ResourceConfig: {
            InstanceType: DEFAULT_INSTANCE_TYPE as TrainingInstanceType,
            InstanceCount: 1,
            VolumeSizeInGB: 100,
          },
        })
        .on(DescribeTrainingJobCommand, { TrainingJobName: 'throttled-job' })
        .rejects(new Error('ThrottlingException'));

      // One successfully-described job must not mask the failure on the other — a partial failure
      // still under-counts usage and must fail closed the same as a total failure.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'UNKNOWN' });
    });

    it('should tolerate a page where TrainingJobSummaries is undefined by treating it as empty', async () => {
      // The paginator may yield a page with a null/undefined TrainingJobSummaries array. The
      // `?? []` fallback must absorb that so no iteration is attempted on a non-iterable.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.IN_PROGRESS })
        // TrainingJobSummaries explicitly absent to exercise the `?? []` null-coalescing branch.
        .resolves({ NextToken: undefined } as { TrainingJobSummaries?: TrainingJobSummary[] })
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.STOPPING })
        .resolves({ TrainingJobSummaries: [] });

      // Zero active jobs → zero usage → capacity must be AVAILABLE.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
    });

    it('should skip summaries with a missing TrainingJobName without adding undefined to the describe queue', async () => {
      // A TrainingJobSummary with no TrainingJobName must be silently skipped — the guard
      // `if (summary.TrainingJobName)` must not push undefined into the describe queue, which
      // would cause DescribeTrainingJob to receive an undefined name and likely fail.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.IN_PROGRESS })
        .resolves({
          // Mix of a valid summary and one with no name — the nameless one must be skipped.
          TrainingJobSummaries: [
            { TrainingJobName: 'named-job' } as TrainingJobSummary,
            {} as TrainingJobSummary, // no TrainingJobName
          ],
        })
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.STOPPING })
        .resolves({ TrainingJobSummaries: [] });
      mockSageMakerClient.on(DescribeTrainingJobCommand, { TrainingJobName: 'named-job' }).resolves({
        ResourceConfig: {
          InstanceType: DEFAULT_INSTANCE_TYPE as TrainingInstanceType,
          InstanceCount: 1,
          VolumeSizeInGB: 100,
        },
      });

      // If the nameless summary were not skipped it would be sent to DescribeTrainingJob with an
      // undefined name, which would fail and cause UNKNOWN.  We expect 1 instance used → AVAILABLE.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
      // Only the named job should have been described — the nameless one must not appear.
      const describeCalls = mockSageMakerClient.commandCalls(DescribeTrainingJobCommand);
      expect(describeCalls).toHaveLength(1);
      expect(describeCalls[0].args[0].input.TrainingJobName).toBe('named-job');
    });

    it('should treat a job with no InstanceCount in ResourceConfig as consuming 0 instances', async () => {
      // DescribeTrainingJob may return a ResourceConfig without InstanceCount for legacy jobs.
      // The `?? 0` fallback must ensure it contributes nothing to usage rather than NaN.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.IN_PROGRESS })
        .resolves({ TrainingJobSummaries: [{ TrainingJobName: 'no-count-job' } as TrainingJobSummary] })
        .on(ListTrainingJobsCommand, { StatusEquals: TrainingJobStatus.STOPPING })
        .resolves({ TrainingJobSummaries: [] });
      mockSageMakerClient.on(DescribeTrainingJobCommand, { TrainingJobName: 'no-count-job' }).resolves({
        ResourceConfig: {
          InstanceType: DEFAULT_INSTANCE_TYPE as TrainingInstanceType,
          // InstanceCount deliberately omitted to exercise the `?? 0` fallback
          VolumeSizeInGB: 100,
        },
      });

      // With an implicit 0 instances in use and a quota of 4, capacity must be AVAILABLE.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
    });

    it('should be a no-op in recordOptimisticDispatch when the usage cache entry was never populated', async () => {
      // recordOptimisticDispatch has a guard: `if (!cached || …) return;`
      // The `!cached` branch fires when usageCache.get() returns undefined — i.e. the cache was
      // never populated for this instance type, or was cleared between the usage read and the
      // dispatch call.  We exercise it by spying on getTrainingInstanceUsage to return usage
      // values WITHOUT writing to the module-level usageCache Map (simulating an already-evicted
      // entry or a first-call race).  The result must still be AVAILABLE — the early return must
      // not crash or alter the final result.
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });

      // Spy on getTrainingInstanceUsage so it returns valid usage (0 jobs) but does NOT populate
      // the usageCache Map, leaving `usageCache.get(effectiveInstanceType)` === undefined when
      // recordOptimisticDispatch is called immediately afterward.
      vi.spyOn(helper, 'getTrainingInstanceUsage').mockResolvedValueOnce({
        effectiveTypeUsage: 0,
        totalInstanceUsage: 0,
      });

      // If the no-op guard were missing or wrong, this call would throw on `cached.value = …`.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'AVAILABLE',
        effectiveInstanceType: DEFAULT_INSTANCE_TYPE,
      });
    });
  });
});
