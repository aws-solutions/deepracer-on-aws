// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import type { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
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
import { s3Helper } from '@deepracer-indy/utils';
import type { MockInstance } from 'vitest';

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
  });

  describe('initializeJob()', () => {
    let createStreamSpy: MockInstance<(typeof kinesisVideoStreamHelper)['createStream']>;
    let createTrainingJobSpy: MockInstance<(typeof sageMakerHelper)['createTrainingJob']>;
    let deleteS3LocationSpy: MockInstance<(typeof s3Helper)['deleteS3Location']>;
    let getJobSpy: MockInstance<(typeof workflowHelper)['getJob']>;
    let modelLoadSpy: MockInstance<(typeof modelDao)['load']>;
    let profileLoadSpy: MockInstance<(typeof profileDao)['load']>;
    let writeJobFilesToS3Spy: MockInstance<(typeof jobInitializer)['writeJobFilesToS3']>;

    beforeEach(() => {
      createStreamSpy = vi.spyOn(kinesisVideoStreamHelper, 'createStream');
      createTrainingJobSpy = vi.spyOn(sageMakerHelper, 'createTrainingJob');
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
      expect(createTrainingJobSpy).toHaveBeenCalledWith({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });
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
      expect(createTrainingJobSpy).toHaveBeenCalledWith({ jobItem: TEST_EVALUATION_ITEM, modelItem: TEST_MODEL_ITEM });
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
      expect(createTrainingJobSpy).toHaveBeenCalledWith({ jobItem: TEST_SUBMISSION_ITEM, modelItem: TEST_MODEL_ITEM });
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
