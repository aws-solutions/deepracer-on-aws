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
  WarmPoolResourceStatus,
} from '@aws-sdk/client-sagemaker';
import {
  type JobItem,
  modelDao,
  ResourceId,
  TEST_EVALUATION_ITEM,
  TEST_MODEL_ITEM,
  TEST_SUBMISSION_ITEM,
  TEST_TRAINING_ITEM,
} from '@deepracer-indy/database';
import { CheckpointSelection } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WARM_POOL_KEEP_ALIVE_SECONDS } from '../../constants/sageMaker.js';
import { SageMakerHyperparameters } from '../../types/sageMakerHyperparameters.js';
import { sageMakerHelper } from '../SageMakerHelper.js';

describe('SageMakerHelper', () => {
  const mockSageMakerClient = mockClient(SageMakerClient);
  const testTrainingJobArn = 'testTrainingJobArn';
  const TEST_SAGEMAKER_ROLE_ARN = 'arn:aws:iam::123456789012:role/SageMakerRole';
  const TEST_SAGEMAKER_EVALUATION_ROLE_ARN = 'arn:aws:iam::123456789012:role/SageMakerEvaluationRole';

  beforeEach(() => {
    mockSageMakerClient.reset();
    // Set required environment variables
    process.env.SAGEMAKER_TRAINING_IMAGE =
      '123456789012.dkr.ecr.us-east-1.amazonaws.com/deepracer-on-aws-sim-app:latest';
    process.env.SAGEMAKER_ROLE_ARN = TEST_SAGEMAKER_ROLE_ARN;
    process.env.SAGEMAKER_EVALUATION_ROLE_ARN = TEST_SAGEMAKER_EVALUATION_ROLE_ARN;
  });

  describe('getSageMakerHyperparameters()', () => {
    const SOURCE_MODEL = { ...TEST_MODEL_ITEM, modelId: 'sourceModelId' as ResourceId };

    it('passes no pre-trained model settings for a model that is not a clone', async () => {
      const hyperparameters = await sageMakerHelper.getSageMakerHyperparameters(TEST_TRAINING_ITEM, {
        ...TEST_MODEL_ITEM,
        clonedFromModelId: undefined,
      });

      expect(hyperparameters).not.toHaveProperty('pretrained_s3_prefix');
      expect(hyperparameters).not.toHaveProperty('pretrained_checkpoint');
    });

    it.each([
      [undefined, 'best'],
      [CheckpointSelection.BEST, 'best'],
      [CheckpointSelection.LAST, 'last'],
    ] as const)('passes the clone checkpoint %s to the SimApp as %s', async (clonedFromCheckpoint, expected) => {
      vi.spyOn(modelDao, 'get').mockResolvedValueOnce(SOURCE_MODEL);

      const hyperparameters = await sageMakerHelper.getSageMakerHyperparameters(TEST_TRAINING_ITEM, {
        ...TEST_MODEL_ITEM,
        clonedFromModelId: SOURCE_MODEL.modelId,
        clonedFromCheckpoint,
      });

      expect(hyperparameters).toMatchObject({ pretrained_checkpoint: expected });
    });

    it('passes the model hyperparameters and reward function location for a training job', async () => {
      const hyperparameters = await sageMakerHelper.getSageMakerHyperparameters(TEST_TRAINING_ITEM, {
        ...TEST_MODEL_ITEM,
        clonedFromModelId: undefined,
      });

      expect(hyperparameters).toMatchObject({
        batch_size: String(TEST_MODEL_ITEM.metadata.hyperparameters.batch_size),
        reward_function_s3_source: TEST_MODEL_ITEM.assetS3Locations.rewardFunctionS3Location,
      });
    });

    it.each<[string, JobItem]>([
      ['an evaluation', TEST_EVALUATION_ITEM],
      ['a community race submission', TEST_SUBMISSION_ITEM],
      [
        'a live race submission',
        {
          ...TEST_SUBMISSION_ITEM,
          name: `${TEST_SUBMISSION_ITEM.name}-live-def456` as typeof TEST_SUBMISSION_ITEM.name,
        },
      ],
    ])('passes no model hyperparameters, reward function or clone source for %s', async (_, jobItem) => {
      const modelDaoGetSpy = vi.spyOn(modelDao, 'get');
      // Extra keys an imported model's hyperparameters.json could carry must not reach these jobs.
      const modelItem = {
        ...TEST_MODEL_ITEM,
        clonedFromModelId: 'sourceModelId' as ResourceId,
        metadata: {
          ...TEST_MODEL_ITEM.metadata,
          hyperparameters: { ...TEST_MODEL_ITEM.metadata.hyperparameters, injected_key: '1; touch /tmp/x' },
        },
      } as typeof TEST_MODEL_ITEM;

      const hyperparameters = await sageMakerHelper.getSageMakerHyperparameters(jobItem, modelItem);

      expect(Object.keys(hyperparameters).sort()).toEqual([
        'aws_region',
        'heartbeat_s3_location',
        'kinesis_stream_name',
        'model_metadata_s3_key',
        's3_bucket',
        's3_prefix',
        's3_ros_log_bucket',
        's3_yaml_name',
        'simulation_launch_file',
        'track_direction_clockwise',
        'world_name',
      ]);
      expect(modelDaoGetSpy).not.toHaveBeenCalled();
    });
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

    it.each<[string, JobItem]>([
      ['an evaluation', TEST_EVALUATION_ITEM],
      ['a community race submission', TEST_SUBMISSION_ITEM],
      [
        'a live race submission',
        // Live race job names add a suffix to the submission's job name (getNextPending).
        {
          ...TEST_SUBMISSION_ITEM,
          name: `${TEST_SUBMISSION_ITEM.name}-live-def456` as typeof TEST_SUBMISSION_ITEM.name,
        },
      ],
    ])('should keep the instance warm after %s', async (_, jobItem) => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls[0].args[0].input.ResourceConfig?.KeepAlivePeriodInSeconds).toBe(WARM_POOL_KEEP_ALIVE_SECONDS);
    });

    it('should not keep the instance warm after a training job', async () => {
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

    it('should run a training job under the ABAC role with session tag chaining', async () => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: mockSageMakerClient as never,
      });

      const { input } = mockSageMakerClient.commandCalls(CreateTrainingJobCommand)[0].args[0];
      expect(input.RoleArn).toBe(TEST_SAGEMAKER_ROLE_ARN);
      expect(input.SessionChainingConfig).toEqual({ EnableSessionTagChaining: true });
    });

    it.each<[string, JobItem]>([
      ['an evaluation', TEST_EVALUATION_ITEM],
      ['a race submission', TEST_SUBMISSION_ITEM],
    ])('should run %s untagged under the shared evaluation role', async (_, jobItem) => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);
      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      // No ABAC-tagged client: the job is created with the Lambda's own credentials.
      await expect(sageMakerHelper.createTrainingJob({ jobItem, modelItem: TEST_MODEL_ITEM })).resolves.toBe(
        testTrainingJobArn,
      );

      const { input } = mockSageMakerClient.commandCalls(CreateTrainingJobCommand)[0].args[0];
      expect(input.RoleArn).toBe(TEST_SAGEMAKER_EVALUATION_ROLE_ARN);
      expect(input.SessionChainingConfig).toBeUndefined();
    });

    it('should refuse to create a training job without an ABAC-tagged client', async () => {
      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      await expect(
        sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM }),
      ).rejects.toThrow('An ABAC-tagged SageMaker client is required');
      expect(mockSageMakerClient.commandCalls(CreateTrainingJobCommand)).toHaveLength(0);
    });

    it('should refuse to create an evaluation when the evaluation role ARN is not set', async () => {
      delete process.env.SAGEMAKER_EVALUATION_ROLE_ARN;

      await expect(
        sageMakerHelper.createTrainingJob({ jobItem: TEST_EVALUATION_ITEM, modelItem: TEST_MODEL_ITEM }),
      ).rejects.toThrow('SageMaker execution role ARN is not set');
      expect(mockSageMakerClient.commandCalls(CreateTrainingJobCommand)).toHaveLength(0);
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
      // No warm pool instances unless a test lists some.
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { WarmPoolStatusEquals: WarmPoolResourceStatus.AVAILABLE })
        .resolves({ TrainingJobSummaries: [], NextToken: undefined });
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

    it('should count instances held in a warm pool by finished jobs', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 2, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 }]);
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { WarmPoolStatusEquals: WarmPoolResourceStatus.AVAILABLE })
        .resolves({ TrainingJobSummaries: [{ TrainingJobName: 'warm-job' } as TrainingJobSummary] })
        .on(DescribeTrainingJobCommand, { TrainingJobName: 'warm-job' })
        .resolves({
          ResourceConfig: {
            InstanceType: DEFAULT_INSTANCE_TYPE as TrainingInstanceType,
            InstanceCount: 1,
            VolumeSizeInGB: 100,
          },
        });

      // 1 active + 1 warm instance fill the quota of 2, so a new job does not fit.
      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'INSTANCE_TYPE_QUOTA',
      });
    });

    it('should count a job listed as both active and warm only once', async () => {
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 2, total: 100 });
      mockActiveJobs([{ name: 'job-a', instanceType: DEFAULT_INSTANCE_TYPE, instanceCount: 1 }]);
      mockSageMakerClient
        .on(ListTrainingJobsCommand, { WarmPoolStatusEquals: WarmPoolResourceStatus.AVAILABLE })
        .resolves({ TrainingJobSummaries: [{ TrainingJobName: 'job-a' } as TrainingJobSummary] });

      await expect(helper.checkTrainingCapacity()).resolves.toMatchObject({ status: 'AVAILABLE' });
      expect(mockSageMakerClient.commandCalls(DescribeTrainingJobCommand)).toHaveLength(1);
    });

    it('should look back far enough to include warm pools of the longest jobs', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
      const helper = await importFreshHelper();
      await mockQuotas({ instanceType: 4, total: 10 });
      mockActiveJobs([]);

      await helper.checkTrainingCapacity();

      const warmPoolCall = mockSageMakerClient
        .commandCalls(ListTrainingJobsCommand)
        .find((call) => call.args[0].input.WarmPoolStatusEquals === WarmPoolResourceStatus.AVAILABLE);
      // 24 h 10 min longest job plus the keep-alive period.
      const expectedLookbackMs = 24 * 60 * 60 * 1000 + 10 * 60 * 1000 + WARM_POOL_KEEP_ALIVE_SECONDS * 1000;
      expect(warmPoolCall?.args[0].input.CreationTimeAfter).toEqual(new Date(Date.now() - expectedLookbackMs));

      vi.useRealTimers();
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
      expect(mockSageMakerClient.commandCalls(ListTrainingJobsCommand)).toHaveLength(3);
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
