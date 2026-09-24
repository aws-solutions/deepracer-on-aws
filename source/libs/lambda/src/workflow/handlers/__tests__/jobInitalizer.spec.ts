// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import type { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
import { SageMakerClient } from '@aws-sdk/client-sagemaker';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import {
  JobType,
  modelDao,
  profileDao,
  TEST_EVALUATION_ITEM,
  TEST_MODEL_ITEM,
  TEST_PROFILE_ITEM,
  TEST_SUBMISSION_ITEM,
  TEST_TRAINING_ITEM,
} from '@deepracer-indy/database';
import { JobStatus, ModelStatus } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';
import type { MockInstance } from 'vitest';

import { CapacityMessage } from '../../constants/capacityMessages.js';
import { CapacityStatus, CapacityUnavailableReason } from '../../types/capacityCheckResult.js';
import type { WorkflowContext } from '../../types/workflowContext.js';
import { kinesisVideoStreamHelper } from '../../utils/KinesisVideoStreamHelper.js';
import { sageMakerHelper } from '../../utils/SageMakerHelper.js';
import { workflowHelper } from '../../utils/WorkflowHelper.js';
import { jobInitializer } from '../jobInitializer.js';

const MOCK_INIT_TRAINING_CONTEXT = {
  jobName: TEST_TRAINING_ITEM.name,
  modelId: TEST_MODEL_ITEM.modelId,
  profileId: TEST_MODEL_ITEM.profileId,
} satisfies WorkflowContext<JobType.TRAINING>;

const MOCK_INIT_EVALUATION_CONTEXT = {
  jobName: TEST_EVALUATION_ITEM.name,
  modelId: TEST_MODEL_ITEM.modelId,
  profileId: TEST_MODEL_ITEM.profileId,
} satisfies WorkflowContext<JobType.EVALUATION>;

const MOCK_INIT_SUBMISSION_CONTEXT = {
  jobName: TEST_SUBMISSION_ITEM.name,
  modelId: TEST_MODEL_ITEM.modelId,
  profileId: TEST_MODEL_ITEM.profileId,
  leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
} satisfies WorkflowContext<JobType.SUBMISSION>;

const expectedTrainingPostInitContext = {
  ...MOCK_INIT_TRAINING_CONTEXT,
  simulationJob: {
    heartbeatS3Location: TEST_TRAINING_ITEM.assetS3Locations.simulationHeartbeatS3Location,
  },
  trainingJob: {
    arn: TEST_TRAINING_ITEM.sageMakerJobArn,
    name: TEST_TRAINING_ITEM.name,
  },
  videoStream: {
    arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
    name: TEST_TRAINING_ITEM.name,
  },
} satisfies WorkflowContext;

describe('JobInitializer', () => {
  let mockInitTrainingContext: WorkflowContext<JobType.TRAINING>;
  let mockInitEvaluationContext: WorkflowContext<JobType.EVALUATION>;
  let mockInitSubmissionContext: WorkflowContext<JobType.SUBMISSION>;

  let initializeJobSpy: MockInstance<(typeof jobInitializer)['initializeJob']>;
  let persistWorkflowDataSpy: MockInstance<(typeof jobInitializer)['persistWorkflowData']>;

  beforeEach(() => {
    initializeJobSpy = vi.spyOn(jobInitializer, 'initializeJob');
    persistWorkflowDataSpy = vi.spyOn(jobInitializer, 'persistWorkflowData');

    mockInitTrainingContext = {
      ...MOCK_INIT_TRAINING_CONTEXT,
    };
    mockInitEvaluationContext = {
      ...MOCK_INIT_EVALUATION_CONTEXT,
    };
    mockInitSubmissionContext = {
      ...MOCK_INIT_SUBMISSION_CONTEXT,
    };
  });

  describe('handler()', () => {
    it('should initialize the job and persist workflow data in happy case', async () => {
      initializeJobSpy.mockImplementationOnce(async (initContext) => {
        initContext.simulationJob = expectedTrainingPostInitContext.simulationJob;
        initContext.trainingJob = expectedTrainingPostInitContext.trainingJob;
        initContext.videoStream = expectedTrainingPostInitContext.videoStream;
        return initContext;
      });
      persistWorkflowDataSpy.mockResolvedValueOnce();

      await expect(jobInitializer.handler(mockInitTrainingContext)).resolves.toEqual(expectedTrainingPostInitContext);

      expect(initializeJobSpy).toHaveBeenCalledWith(mockInitTrainingContext);
      expect(persistWorkflowDataSpy).toHaveBeenCalledWith(expectedTrainingPostInitContext);
    });

    it('should add error details to workflow context and persist workflow data in error case', async () => {
      const initializeJobError = new Error('Initialize job failure');
      initializeJobSpy.mockRejectedValueOnce(initializeJobError);
      persistWorkflowDataSpy.mockResolvedValueOnce();

      const updatedContext = {
        ...mockInitTrainingContext,
        errorDetails: { message: initializeJobError.message, stack: initializeJobError.stack },
      };

      await expect(jobInitializer.handler(mockInitTrainingContext)).resolves.toEqual(updatedContext);

      expect(initializeJobSpy).toHaveBeenCalledWith(mockInitTrainingContext);
      expect(persistWorkflowDataSpy).toHaveBeenCalledWith(updatedContext);
    });

    it('should mark the job as waiting for capacity, not failed, when SageMaker returns ResourceLimitExceeded', async () => {
      const resourceLimitError = Object.assign(new Error('quota exceeded'), { name: 'ResourceLimitExceeded' });
      initializeJobSpy.mockRejectedValueOnce(resourceLimitError);
      persistWorkflowDataSpy.mockResolvedValueOnce();

      const result = await jobInitializer.handler(mockInitTrainingContext);

      expect(result.capacityWaiting).toBe(true);
      expect(result.statusMessage).toBe(CapacityMessage.UNAVAILABLE);
      // errorDetails must stay unset, or the state machine routes to the failure branch and the model
      // becomes ERROR instead of retryable.
      expect(result.errorDetails).toBeUndefined();
    });

    it.each([
      ['evaluation', MOCK_INIT_EVALUATION_CONTEXT],
      ['submission', MOCK_INIT_SUBMISSION_CONTEXT],
    ])(
      'should treat ResourceLimitExceeded on a %s job as a normal failure, not capacity waiting',
      async (_label, context) => {
        const resourceLimitError = Object.assign(new Error('quota exceeded'), { name: 'ResourceLimitExceeded' });
        initializeJobSpy.mockRejectedValueOnce(resourceLimitError);
        persistWorkflowDataSpy.mockResolvedValueOnce();

        const result = await jobInitializer.handler({ ...context });

        // WAITING_FOR_CAPACITY and RetryTraining are training-only. Routing a non-training job there
        // would strand it in a status nothing can recover from.
        expect(result.capacityWaiting).toBeUndefined();
        expect(result.errorDetails).toBeDefined();
      },
    );

    it('should set errorDetails (not capacityWaiting) when initializeJob throws a non-capacity error', async () => {
      // Any error whose .name is not 'ResourceLimitExceeded' must go through the normal failure
      // path so the job ends up FAILED rather than silently stuck as WAITING_FOR_CAPACITY.
      const genericError = new Error('Unexpected SageMaker failure');
      initializeJobSpy.mockRejectedValueOnce(genericError);
      persistWorkflowDataSpy.mockResolvedValueOnce();

      const result = await jobInitializer.handler(mockInitTrainingContext);

      expect(result.errorDetails).toBeDefined();
      expect(result.capacityWaiting).toBeUndefined();
      expect(result.statusMessage).toBeUndefined();
    });
  });

  describe('persistWorkflowData()', () => {
    let updateModelSpy: MockInstance<(typeof modelDao)['update']>;
    let updateJobSpy: MockInstance<(typeof workflowHelper)['updateJob']>;

    beforeEach(() => {
      updateModelSpy = vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
      updateJobSpy = vi.spyOn(workflowHelper, 'updateJob').mockResolvedValue(TEST_TRAINING_ITEM);
    });

    it('should set WAITING_FOR_CAPACITY status when capacityWaiting is true, even if errorDetails is also set', async () => {
      // capacityWaiting must win over errorDetails so the model stays retryable rather than
      // being permanently marked ERROR/FAILED.
      mockInitTrainingContext.capacityWaiting = true;
      mockInitTrainingContext.statusMessage = CapacityMessage.UNAVAILABLE;
      mockInitTrainingContext.errorDetails = new Error('some extra error that must not override capacity path');

      await jobInitializer.persistWorkflowData(mockInitTrainingContext);

      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitTrainingContext.modelId, profileId: mockInitTrainingContext.profileId },
        { status: ModelStatus.WAITING_FOR_CAPACITY, statusMessage: CapacityMessage.UNAVAILABLE },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitTrainingContext.jobName,
          modelId: mockInitTrainingContext.modelId,
          profileId: mockInitTrainingContext.profileId,
          leaderboardId: mockInitTrainingContext.leaderboardId,
        },
        expect.objectContaining({ status: JobStatus.WAITING_FOR_CAPACITY }),
      );
    });

    it('should not set WAITING_FOR_CAPACITY for a non-training job even if capacityWaiting is set', async () => {
      // Defence in depth: WAITING_FOR_CAPACITY is training-only, and no RetryTraining path exists for
      // an evaluation, so persisting it here would strand the job.
      mockInitEvaluationContext.capacityWaiting = true;
      mockInitEvaluationContext.errorDetails = new Error('ResourceLimitExceeded on an evaluation');

      await jobInitializer.persistWorkflowData(mockInitEvaluationContext);

      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitEvaluationContext.modelId, profileId: mockInitEvaluationContext.profileId },
        expect.objectContaining({ status: ModelStatus.READY }),
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: JobStatus.FAILED }),
      );
    });
  });

  describe('initializeJob()', () => {
    const TEST_JOB_CREATION_ROLE_ARN = 'arn:aws:iam::123456789012:role/test-job-creation-role';
    const stsMock = mockClient(STSClient);

    let createStreamSpy: MockInstance<(typeof kinesisVideoStreamHelper)['createStream']>;
    let createTrainingJobSpy: MockInstance<(typeof sageMakerHelper)['createTrainingJob']>;
    let checkTrainingCapacitySpy: MockInstance<(typeof sageMakerHelper)['checkTrainingCapacity']>;
    let deleteS3LocationSpy: MockInstance<(typeof s3Helper)['deleteS3Location']>;
    let getJobSpy: MockInstance<(typeof workflowHelper)['getJob']>;
    let modelLoadSpy: MockInstance<(typeof modelDao)['load']>;
    let profileLoadSpy: MockInstance<(typeof profileDao)['load']>;
    let writeJobFilesToS3Spy: MockInstance<(typeof jobInitializer)['writeJobFilesToS3']>;

    beforeEach(() => {
      process.env.SAGEMAKER_JOB_CREATION_ROLE_ARN = TEST_JOB_CREATION_ROLE_ARN;
      stsMock.reset();
      stsMock.on(AssumeRoleCommand).resolves({
        Credentials: {
          AccessKeyId: 'test-access-key-id',
          SecretAccessKey: 'test-secret-access-key',
          SessionToken: 'test-session-token',
          Expiration: new Date(Date.now() + 3_600_000),
        },
      });
      createStreamSpy = vi.spyOn(kinesisVideoStreamHelper, 'createStream');
      createTrainingJobSpy = vi.spyOn(sageMakerHelper, 'createTrainingJob');
      checkTrainingCapacitySpy = vi.spyOn(sageMakerHelper, 'checkTrainingCapacity').mockResolvedValue({
        status: CapacityStatus.AVAILABLE,
        effectiveInstanceType: 'ml.c7i.4xlarge',
        requiredInstanceCount: 1,
      });
      deleteS3LocationSpy = vi.spyOn(s3Helper, 'deleteS3Location');
      getJobSpy = vi.spyOn(workflowHelper, 'getJob');
      modelLoadSpy = vi.spyOn(modelDao, 'load');
      profileLoadSpy = vi.spyOn(profileDao, 'load');
      writeJobFilesToS3Spy = vi.spyOn(jobInitializer, 'writeJobFilesToS3');
    });

    it('should initialize training job', async () => {
      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      createTrainingJobSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.trainingJob.arn);

      await expect(jobInitializer.initializeJob(mockInitTrainingContext)).resolves.toEqual(
        expectedTrainingPostInitContext,
      );

      expect(getJobSpy).toHaveBeenCalledWith({
        jobName: mockInitTrainingContext.jobName,
        modelId: mockInitTrainingContext.modelId,
        profileId: mockInitTrainingContext.profileId,
        leaderboardId: mockInitTrainingContext.leaderboardId,
      });
      expect(modelLoadSpy).toHaveBeenCalledWith({
        modelId: mockInitTrainingContext.modelId,
        profileId: mockInitTrainingContext.profileId,
      });
      expect(profileLoadSpy).toHaveBeenCalledWith({ profileId: mockInitTrainingContext.profileId });
      expect(createStreamSpy).toHaveBeenCalledWith(mockInitTrainingContext.jobName);
      expect(writeJobFilesToS3Spy).toHaveBeenCalledWith(TEST_TRAINING_ITEM, TEST_MODEL_ITEM, TEST_PROFILE_ITEM);
      expect(deleteS3LocationSpy).not.toHaveBeenCalled();
      expect(checkTrainingCapacitySpy).toHaveBeenCalled();
      expect(createTrainingJobSpy).toHaveBeenCalledWith({
        jobItem: TEST_TRAINING_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: expect.any(SageMakerClient),
      });
    });

    it('should not create a SageMaker job when capacity disappeared before CreateTrainingJob', async () => {
      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      checkTrainingCapacitySpy.mockResolvedValueOnce({
        status: CapacityStatus.UNAVAILABLE,
        effectiveInstanceType: 'ml.c7i.4xlarge',
        requiredInstanceCount: 1,
        reason: CapacityUnavailableReason.INSTANCE_TYPE_QUOTA,
      });

      const result = await jobInitializer.initializeJob(mockInitTrainingContext);

      expect(result.capacityWaiting).toBe(true);
      expect(result.statusMessage).toBe(CapacityMessage.UNAVAILABLE);
      // No SageMaker job exists, so JobMonitor must not run.
      expect(result.trainingJob).toBeUndefined();
      expect(createTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should fail closed with the unknown-capacity message when the quota check errors', async () => {
      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      checkTrainingCapacitySpy.mockResolvedValueOnce({
        status: CapacityStatus.UNKNOWN,
        error: new Error('AccessDenied'),
      });

      const result = await jobInitializer.initializeJob(mockInitTrainingContext);

      expect(result.capacityWaiting).toBe(true);
      // It must not claim a specific quota is exhausted when it could not verify capacity.
      expect(result.statusMessage).toBe(CapacityMessage.UNKNOWN);
      expect(createTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should not check training capacity for evaluation jobs', async () => {
      getJobSpy.mockResolvedValueOnce(TEST_EVALUATION_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce('arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname');
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      deleteS3LocationSpy.mockResolvedValueOnce();
      createTrainingJobSpy.mockResolvedValueOnce(TEST_EVALUATION_ITEM.sageMakerJobArn);

      await jobInitializer.initializeJob(mockInitEvaluationContext);

      expect(checkTrainingCapacitySpy).not.toHaveBeenCalled();
    });

    it('should initialize evaluation job', async () => {
      const expectedEvaluationPostInitContext = {
        ...MOCK_INIT_EVALUATION_CONTEXT,
        simulationJob: {
          heartbeatS3Location: TEST_EVALUATION_ITEM.assetS3Locations.simulationHeartbeatS3Location,
        },
        trainingJob: {
          arn: TEST_EVALUATION_ITEM.sageMakerJobArn,
          name: TEST_EVALUATION_ITEM.name,
        },
        videoStream: {
          arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
          name: TEST_EVALUATION_ITEM.name,
        },
      } satisfies WorkflowContext<JobType.EVALUATION>;

      getJobSpy.mockResolvedValueOnce(TEST_EVALUATION_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedEvaluationPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      deleteS3LocationSpy.mockResolvedValueOnce();
      createTrainingJobSpy.mockResolvedValueOnce(expectedEvaluationPostInitContext.trainingJob.arn);

      await expect(jobInitializer.initializeJob(mockInitEvaluationContext)).resolves.toEqual(
        expectedEvaluationPostInitContext,
      );

      expect(getJobSpy).toHaveBeenCalledWith({
        jobName: mockInitEvaluationContext.jobName,
        modelId: mockInitEvaluationContext.modelId,
        profileId: mockInitEvaluationContext.profileId,
        leaderboardId: mockInitEvaluationContext.leaderboardId,
      });
      expect(modelLoadSpy).toHaveBeenCalledWith({
        modelId: mockInitEvaluationContext.modelId,
        profileId: mockInitEvaluationContext.profileId,
      });
      expect(profileLoadSpy).toHaveBeenCalledWith({ profileId: mockInitEvaluationContext.profileId });
      expect(createStreamSpy).toHaveBeenCalledWith(mockInitEvaluationContext.jobName);
      expect(writeJobFilesToS3Spy).toHaveBeenCalledWith(TEST_EVALUATION_ITEM, TEST_MODEL_ITEM, TEST_PROFILE_ITEM);
      expect(deleteS3LocationSpy).toHaveBeenCalledWith(
        TEST_EVALUATION_ITEM.assetS3Locations.simulationHeartbeatS3Location,
      );
      expect(createTrainingJobSpy).toHaveBeenCalledWith({
        jobItem: TEST_EVALUATION_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: expect.any(SageMakerClient),
      });
    });

    it('should initialize submission job', async () => {
      const expectedSubmissionPostInitContext = {
        ...MOCK_INIT_SUBMISSION_CONTEXT,
        simulationJob: {
          heartbeatS3Location: TEST_SUBMISSION_ITEM.assetS3Locations.simulationHeartbeatS3Location,
        },
        trainingJob: {
          arn: TEST_SUBMISSION_ITEM.sageMakerJobArn,
          name: TEST_SUBMISSION_ITEM.name,
        },
        videoStream: {
          arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
          name: TEST_SUBMISSION_ITEM.name,
        },
      } satisfies WorkflowContext<JobType.SUBMISSION>;

      getJobSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedSubmissionPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      deleteS3LocationSpy.mockResolvedValueOnce();
      createTrainingJobSpy.mockResolvedValueOnce(expectedSubmissionPostInitContext.trainingJob.arn);

      await expect(jobInitializer.initializeJob(mockInitSubmissionContext)).resolves.toEqual(
        expectedSubmissionPostInitContext,
      );

      expect(getJobSpy).toHaveBeenCalledWith({
        jobName: mockInitSubmissionContext.jobName,
        modelId: mockInitSubmissionContext.modelId,
        profileId: mockInitSubmissionContext.profileId,
        leaderboardId: mockInitSubmissionContext.leaderboardId,
      });
      expect(modelLoadSpy).toHaveBeenCalledWith({
        modelId: mockInitSubmissionContext.modelId,
        profileId: mockInitSubmissionContext.profileId,
      });
      expect(profileLoadSpy).toHaveBeenCalledWith({ profileId: mockInitSubmissionContext.profileId });
      expect(createStreamSpy).toHaveBeenCalledWith(mockInitSubmissionContext.jobName);
      expect(writeJobFilesToS3Spy).toHaveBeenCalledWith(TEST_SUBMISSION_ITEM, TEST_MODEL_ITEM, TEST_PROFILE_ITEM);
      expect(deleteS3LocationSpy).toHaveBeenCalledWith(
        TEST_SUBMISSION_ITEM.assetS3Locations.simulationHeartbeatS3Location,
      );
      expect(createTrainingJobSpy).toHaveBeenCalledWith({
        jobItem: TEST_SUBMISSION_ITEM,
        modelItem: TEST_MODEL_ITEM,
        client: expect.any(SageMakerClient),
      });
    });

    it('should use context jobName over jobItem name for live races', async () => {
      const liveJobName = `${TEST_SUBMISSION_ITEM.name}-live-abcd1234` as typeof TEST_SUBMISSION_ITEM.name;
      const liveContext = { ...MOCK_INIT_SUBMISSION_CONTEXT, jobName: liveJobName };

      getJobSpy.mockResolvedValueOnce({ ...TEST_SUBMISSION_ITEM });
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce('arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname');
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      deleteS3LocationSpy.mockResolvedValueOnce();
      createTrainingJobSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM.sageMakerJobArn);

      await jobInitializer.initializeJob(liveContext);

      expect(createTrainingJobSpy).toHaveBeenCalledWith(
        expect.objectContaining({ jobItem: expect.objectContaining({ name: liveJobName }) }),
      );
    });

    it('should assume the job-creation role with the profile-id session tag (ABAC)', async () => {
      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);
      createTrainingJobSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.trainingJob.arn);

      await jobInitializer.initializeJob(mockInitTrainingContext);

      // The session tag is what the execution role's S3 policy scopes on
      // (${aws:PrincipalTag/profile-id}); a wrong or missing tag would grant the training
      // container no S3 access, or the wrong profile's.
      const assumeRoleCalls = stsMock.commandCalls(AssumeRoleCommand);
      expect(assumeRoleCalls).toHaveLength(1);
      expect(assumeRoleCalls[0].args[0].input).toEqual({
        RoleArn: TEST_JOB_CREATION_ROLE_ARN,
        RoleSessionName: `training-${mockInitTrainingContext.profileId}`,
        Tags: [{ Key: 'profile-id', Value: mockInitTrainingContext.profileId }],
      });
    });

    it('should fail without creating a training job when SAGEMAKER_JOB_CREATION_ROLE_ARN is unset', async () => {
      // Fail closed: an untagged CreateTrainingJob would launch a container whose ABAC-scoped
      // role resolves to no S3 access, failing deep into training instead of here.
      delete process.env.SAGEMAKER_JOB_CREATION_ROLE_ARN;

      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);

      await expect(jobInitializer.initializeJob(mockInitTrainingContext)).rejects.toThrow(
        'SAGEMAKER_JOB_CREATION_ROLE_ARN',
      );
      expect(createTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should fail without creating a training job when STS returns no credentials', async () => {
      stsMock.on(AssumeRoleCommand).resolves({});

      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);

      await expect(jobInitializer.initializeJob(mockInitTrainingContext)).rejects.toThrow(
        'STS AssumeRole for ABAC returned no credentials',
      );
      expect(createTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should fail without creating a training job when profileId is not a valid ResourceId', async () => {
      const invalidContext = { ...mockInitTrainingContext, profileId: '../traversal-attempt' as never };

      getJobSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);
      modelLoadSpy.mockResolvedValueOnce(TEST_MODEL_ITEM);
      profileLoadSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createStreamSpy.mockResolvedValueOnce(expectedTrainingPostInitContext.videoStream.arn);
      writeJobFilesToS3Spy.mockResolvedValueOnce([]);

      await expect(jobInitializer.initializeJob(invalidContext)).rejects.toThrow('profileId is not a valid ResourceId');
      expect(createTrainingJobSpy).not.toHaveBeenCalled();
      expect(stsMock.commandCalls(AssumeRoleCommand)).toHaveLength(0);
    });
  });

  describe('writeJobFilesToS3', () => {
    const testWriteFileOutput = { $metadata: {} } as CompleteMultipartUploadCommandOutput;

    let writeModelMetadataToS3Spy: MockInstance<(typeof jobInitializer)['writeModelMetadataToS3']>;
    let writeRewardFunctionToS3Spy: MockInstance<(typeof jobInitializer)['writeRewardFunctionToS3']>;
    let writeSimulationYAMLToS3Spy: MockInstance<(typeof jobInitializer)['writeSimulationYAMLToS3']>;

    beforeEach(() => {
      writeModelMetadataToS3Spy = vi.spyOn(jobInitializer, 'writeModelMetadataToS3');
      writeRewardFunctionToS3Spy = vi.spyOn(jobInitializer, 'writeRewardFunctionToS3');
      writeSimulationYAMLToS3Spy = vi.spyOn(jobInitializer, 'writeSimulationYAMLToS3');
    });

    it('should write simulation YAML, but not model metadata or reward function, for evaluation and submission jobs', async () => {
      writeSimulationYAMLToS3Spy.mockResolvedValue(testWriteFileOutput);

      await expect(
        jobInitializer.writeJobFilesToS3(TEST_EVALUATION_ITEM, TEST_MODEL_ITEM, TEST_PROFILE_ITEM),
      ).resolves.toEqual([testWriteFileOutput]);

      expect(writeSimulationYAMLToS3Spy).toHaveBeenCalledTimes(1);
      expect(writeSimulationYAMLToS3Spy).toHaveBeenNthCalledWith(
        1,
        TEST_EVALUATION_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      await expect(
        jobInitializer.writeJobFilesToS3(TEST_SUBMISSION_ITEM, TEST_MODEL_ITEM, TEST_PROFILE_ITEM),
      ).resolves.toEqual([testWriteFileOutput]);

      expect(writeSimulationYAMLToS3Spy).toHaveBeenCalledTimes(2);
      expect(writeSimulationYAMLToS3Spy).toHaveBeenNthCalledWith(
        2,
        TEST_SUBMISSION_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(writeModelMetadataToS3Spy).not.toHaveBeenCalled();
      expect(writeRewardFunctionToS3Spy).not.toHaveBeenCalled();
    });

    it('should write simulation YAML, model metadata, and reward function, for training jobs', async () => {
      writeModelMetadataToS3Spy.mockResolvedValueOnce(testWriteFileOutput);
      writeRewardFunctionToS3Spy.mockResolvedValueOnce(testWriteFileOutput);
      writeSimulationYAMLToS3Spy.mockResolvedValueOnce(testWriteFileOutput);

      await expect(
        jobInitializer.writeJobFilesToS3(TEST_TRAINING_ITEM, TEST_MODEL_ITEM, TEST_PROFILE_ITEM),
      ).resolves.toEqual([testWriteFileOutput, testWriteFileOutput, testWriteFileOutput]);

      expect(writeModelMetadataToS3Spy).toHaveBeenCalledTimes(1);
      expect(writeRewardFunctionToS3Spy).toHaveBeenCalledTimes(1);
      expect(writeSimulationYAMLToS3Spy).toHaveBeenCalledTimes(1);
    });
  });
});
