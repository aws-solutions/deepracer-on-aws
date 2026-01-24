// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import {
  JobType,
  leaderboardDao,
  modelDao,
  profileDao,
  rankingDao,
  submissionDao,
  accountResourceUsageDao,
  TEST_EVALUATION_ITEM,
  TEST_LEADERBOARD_ITEM,
  TEST_MODEL_ITEM,
  TEST_PROFILE_ITEM,
  TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS,
  TEST_PROFILE_ITEM_WITH_UNDEFINED_USAGE_AND_LIMITS,
  TEST_RANKING_ITEM,
  TEST_SUBMISSION_ITEM,
  TEST_TRAINING_ITEM,
  TEST_ACCOUNT_RESOURCE_USAGE_EMPTY,
  TEST_ACCOUNT_RESOURCE_USAGE_NORMAL,
  TEST_ACCOUNT_RESOURCE_USAGE_NORMAL2,
  s3PathHelper,
} from '@deepracer-indy/database';
import { JobStatus, ModelStatus, SubmissionStats } from '@deepracer-indy/typescript-server-client';
import { metricsLogger, metrics } from '@deepracer-indy/utils';
import { MockInstance } from 'vitest';

import { cloudWatchLogsHelper } from '../../../utils/CloudWatchLogsHelper.js';
import { INVALID_RANKING_SCORE } from '../../constants/rankingScore.js';
import {
  EVALUATION_SIMULATION_LOG_GROUP,
  TRAINING_SIMULATION_LOG_GROUP,
  TRAINING_TRAINING_LOG_GROUP,
} from '../../constants/simulation.js';
import type { WorkflowContext } from '../../types/workflowContext.js';
import { kinesisVideoStreamHelper } from '../../utils/KinesisVideoStreamHelper.js';
import { modelPerformanceMetricsHelper } from '../../utils/ModelPerformanceMetricsHelper.js';
import { sageMakerHelper } from '../../utils/SageMakerHelper.js';
import { workflowHelper } from '../../utils/WorkflowHelper.js';
import { jobFinalizer } from '../jobFinalizer.js';

const MOCK_INIT_TRAINING_CONTEXT = {
  jobName: TEST_TRAINING_ITEM.name,
  modelId: TEST_TRAINING_ITEM.modelId,
  profileId: TEST_TRAINING_ITEM.profileId,
  simulationJob: {
    heartbeatS3Location: TEST_TRAINING_ITEM.assetS3Locations.simulationHeartbeatS3Location,
  },
  trainingJob: {
    name: TEST_TRAINING_ITEM.name,
    arn: TEST_TRAINING_ITEM.sageMakerJobArn,
    status: TrainingJobStatus.COMPLETED,
  },
  videoStream: {
    arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
    name: TEST_TRAINING_ITEM.name,
  },
} satisfies WorkflowContext<JobType.TRAINING>;

const MOCK_INIT_EVALUATION_CONTEXT = {
  jobName: TEST_EVALUATION_ITEM.name,
  modelId: TEST_EVALUATION_ITEM.modelId,
  profileId: TEST_EVALUATION_ITEM.profileId,
  simulationJob: {
    heartbeatS3Location: TEST_EVALUATION_ITEM.assetS3Locations.simulationHeartbeatS3Location,
  },
  trainingJob: {
    name: TEST_EVALUATION_ITEM.name,
    arn: TEST_EVALUATION_ITEM.sageMakerJobArn,
    status: TrainingJobStatus.COMPLETED,
  },
  videoStream: {
    arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
    name: TEST_EVALUATION_ITEM.name,
  },
} satisfies WorkflowContext<JobType.EVALUATION>;

const MOCK_INIT_SUBMISSION_CONTEXT = {
  jobName: TEST_SUBMISSION_ITEM.name,
  modelId: TEST_SUBMISSION_ITEM.modelId,
  profileId: TEST_SUBMISSION_ITEM.profileId,
  simulationJob: {
    heartbeatS3Location: TEST_SUBMISSION_ITEM.assetS3Locations.simulationHeartbeatS3Location,
  },
  leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
  trainingJob: {
    name: TEST_SUBMISSION_ITEM.name,
    arn: TEST_SUBMISSION_ITEM.sageMakerJobArn,
    status: TrainingJobStatus.COMPLETED,
  },
  videoStream: {
    arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
    name: TEST_SUBMISSION_ITEM.name,
  },
} satisfies WorkflowContext<JobType.SUBMISSION>;

vi.mock('@deepracer-indy/database', async (importOriginal) => ({
  ...(await importOriginal()),
  s3PathHelper: {
    getLogsS3Location: vi.fn(),
  },
}));

vi.mock('#utils/CloudWatchLogsHelper.js');

describe('JobFinalizer', () => {
  const TEST_TIMESTAMP = new Date('2024-01-01').toISOString();
  let currentYear: number;
  let currentMonth: number;
  let mockInitTrainingContext: WorkflowContext<JobType.TRAINING>;
  let mockInitEvaluationContext: WorkflowContext<JobType.EVALUATION>;
  let mockInitSubmissionContext: WorkflowContext<JobType.SUBMISSION>;

  let createRankingSpy: MockInstance<(typeof rankingDao)['create']>;
  let deleteStreamSpy: MockInstance<(typeof kinesisVideoStreamHelper)['deleteStream']>;
  let getJobSpy: MockInstance<(typeof workflowHelper)['getJob']>;
  let getRankingScoreSpy: MockInstance<(typeof modelPerformanceMetricsHelper)['getRankingScore']>;
  let getRankingSpy: MockInstance<(typeof rankingDao)['get']>;
  let getSubmissionStatsSpy: MockInstance<(typeof modelPerformanceMetricsHelper)['getSubmissionStats']>;
  let loadLeaderboardSpy: MockInstance<(typeof leaderboardDao)['load']>;
  let loadProfileSpy: MockInstance<(typeof profileDao)['load']>;
  let loadSubmissionSpy: MockInstance<(typeof submissionDao)['load']>;
  let persistEvaluationMetricsSpy: MockInstance<(typeof jobFinalizer)['persistEvaluationMetrics']>;
  let persistSubmissionStatsSpy: MockInstance<(typeof jobFinalizer)['persistSubmissionStats']>;
  let persistRankingStatsSpy: MockInstance<(typeof jobFinalizer)['persistRankingStats']>;
  let stopTrainingJobSpy: MockInstance<(typeof sageMakerHelper)['stopTrainingJob']>;
  let updateJobSpy: MockInstance<(typeof workflowHelper)['updateJob']>;
  let updateLeaderboardSpy: MockInstance<(typeof leaderboardDao)['update']>;
  let updateModelSpy: MockInstance<(typeof modelDao)['update']>;
  let updateRankingSpy: MockInstance<(typeof rankingDao)['update']>;
  let updateSubmissionSpy: MockInstance<(typeof submissionDao)['update']>;
  let updateAccountResourceUsageSpy: MockInstance<(typeof accountResourceUsageDao)['update']>;
  let updateProfileSpy: MockInstance<(typeof profileDao)['update']>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2024-01-01'));

    currentYear = new Date().getFullYear();
    currentMonth = new Date().getMonth() + 1;

    mockInitTrainingContext = {
      ...MOCK_INIT_TRAINING_CONTEXT,
    };
    mockInitEvaluationContext = {
      ...MOCK_INIT_EVALUATION_CONTEXT,
    };
    mockInitSubmissionContext = {
      ...MOCK_INIT_SUBMISSION_CONTEXT,
    };

    createRankingSpy = vi.spyOn(rankingDao, 'create');
    deleteStreamSpy = vi.spyOn(kinesisVideoStreamHelper, 'deleteStream').mockResolvedValue();
    getJobSpy = vi.spyOn(workflowHelper, 'getJob');
    getRankingScoreSpy = vi.spyOn(modelPerformanceMetricsHelper, 'getRankingScore');
    getRankingSpy = vi.spyOn(rankingDao, 'get');
    getSubmissionStatsSpy = vi.spyOn(modelPerformanceMetricsHelper, 'getSubmissionStats');
    loadLeaderboardSpy = vi.spyOn(leaderboardDao, 'load');
    loadProfileSpy = vi.spyOn(profileDao, 'load');
    loadSubmissionSpy = vi.spyOn(submissionDao, 'load');
    persistEvaluationMetricsSpy = vi.spyOn(jobFinalizer, 'persistEvaluationMetrics');
    persistSubmissionStatsSpy = vi.spyOn(jobFinalizer, 'persistSubmissionStats');
    persistRankingStatsSpy = vi.spyOn(jobFinalizer, 'persistRankingStats');
    stopTrainingJobSpy = vi.spyOn(sageMakerHelper, 'stopTrainingJob');
    updateJobSpy = vi.spyOn(workflowHelper, 'updateJob').mockResolvedValue(TEST_TRAINING_ITEM);
    updateLeaderboardSpy = vi.spyOn(leaderboardDao, 'update');
    updateModelSpy = vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
    updateRankingSpy = vi.spyOn(rankingDao, 'update');
    updateSubmissionSpy = vi.spyOn(submissionDao, 'update');
    updateAccountResourceUsageSpy = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    updateProfileSpy = vi.spyOn(profileDao, 'update');
    vi.spyOn(metricsLogger, 'logDeepRacerJob').mockImplementation(() => undefined);
    vi.spyOn(metrics, 'addMetric').mockImplementation(() => undefined);
    vi.spyOn(metrics, 'addDimension').mockImplementation(() => undefined);
  });

  describe('handler()', () => {
    it('should finalize the job and persist workflow data', async () => {
      const expectedPostFinalizeContext: WorkflowContext = {
        ...mockInitTrainingContext,
        trainingJob: {
          ...MOCK_INIT_TRAINING_CONTEXT.trainingJob,
          modelArtifactS3Location: TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location,
        },
      };

      const finalizeJobSpy = vi.spyOn(jobFinalizer, 'finalizeJob').mockImplementation(async (initContext) => {
        initContext.trainingJob = expectedPostFinalizeContext.trainingJob;
        return initContext;
      });
      const persistWorkflowDataSpy = vi.spyOn(jobFinalizer, 'persistWorkflowData').mockResolvedValueOnce();

      await expect(jobFinalizer.handler(mockInitTrainingContext)).resolves.toEqual(expectedPostFinalizeContext);

      expect(finalizeJobSpy).toHaveBeenCalledWith(mockInitTrainingContext);
      expect(persistWorkflowDataSpy).toHaveBeenCalledWith(expectedPostFinalizeContext);
    });

    it('should persist workflow data if an error is encountered', async () => {
      const finalizeJobError = new Error('Finalize job failure');
      const finalizeJobSpy = vi.spyOn(jobFinalizer, 'finalizeJob').mockRejectedValueOnce(finalizeJobError);
      const persistWorkflowDataSpy = vi.spyOn(jobFinalizer, 'persistWorkflowData').mockResolvedValueOnce();

      const updatedContext = {
        ...mockInitTrainingContext,
        errorDetails: { message: finalizeJobError.message, stack: finalizeJobError.stack },
      };

      await expect(jobFinalizer.handler(mockInitTrainingContext)).resolves.toEqual(updatedContext);

      expect(finalizeJobSpy).toHaveBeenCalledWith(mockInitTrainingContext);
      expect(persistWorkflowDataSpy).toHaveBeenCalledWith(updatedContext);
    });
  });

  describe('finalizeJob()', () => {
    it('should finalize training job', async () => {
      vi.spyOn(accountResourceUsageDao, 'get').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL2);
      vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.COMPLETED,
        ModelArtifacts: { S3ModelArtifacts: TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location },
        StoppingCondition: { MaxRuntimeInSeconds: 600 },
        TrainingTimeInSeconds: 60,
      } as Awaited<ReturnType<(typeof sageMakerHelper)['getTrainingJob']>>);
      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
      updateProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
      vi.spyOn(jobFinalizer, 'writeTrainingLogsToS3').mockImplementationOnce(() => Promise.resolve());
      vi.spyOn(jobFinalizer, 'writeSimulationLogsToS3');

      await expect(jobFinalizer.finalizeJob(mockInitTrainingContext)).resolves.toEqual(mockInitTrainingContext);

      expect(updateAccountResourceUsageSpy).toHaveBeenCalledWith(
        { year: currentYear, month: currentMonth },
        { accountComputeMinutesQueued: 290, accountComputeMinutesUsed: 401 },
      );
      expect(deleteStreamSpy).toHaveBeenCalledWith(mockInitTrainingContext.videoStream?.arn);
      expect(stopTrainingJobSpy).not.toHaveBeenCalled();
      expect(jobFinalizer.writeTrainingLogsToS3).toHaveBeenCalledWith(mockInitTrainingContext);
      expect(jobFinalizer.writeSimulationLogsToS3).not.toHaveBeenCalled();
      expect(updateProfileSpy).toHaveBeenCalledWith(
        { profileId: mockInitEvaluationContext.profileId },
        { computeMinutesQueued: 90, computeMinutesUsed: 301 },
      );
    });

    it('should finalize evaluation job', async () => {
      vi.spyOn(accountResourceUsageDao, 'get').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
      vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.COMPLETED,
        ModelArtifacts: { S3ModelArtifacts: TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location },
        StoppingCondition: undefined,
        TrainingTimeInSeconds: 60,
      } as Awaited<ReturnType<(typeof sageMakerHelper)['getTrainingJob']>>);
      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
      updateProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
      vi.spyOn(jobFinalizer, 'writeTrainingLogsToS3');
      vi.spyOn(jobFinalizer, 'writeSimulationLogsToS3').mockImplementationOnce(() => Promise.resolve());

      await expect(jobFinalizer.finalizeJob(mockInitEvaluationContext)).resolves.toEqual(mockInitEvaluationContext);

      expect(updateAccountResourceUsageSpy).toHaveBeenCalledWith(
        { year: currentYear, month: currentMonth },
        { accountComputeMinutesQueued: 0, accountComputeMinutesUsed: 0 },
      );
      expect(deleteStreamSpy).toHaveBeenCalledWith(mockInitEvaluationContext.videoStream?.arn);
      expect(stopTrainingJobSpy).not.toHaveBeenCalled();
      expect(jobFinalizer.writeSimulationLogsToS3).toHaveBeenCalledWith(mockInitEvaluationContext);
      expect(jobFinalizer.writeTrainingLogsToS3).not.toHaveBeenCalled();
      expect(updateProfileSpy).toHaveBeenCalledWith(
        { profileId: mockInitEvaluationContext.profileId },
        { computeMinutesQueued: 100, computeMinutesUsed: 300 },
      );
    });

    it('should finalize submission job', async () => {
      vi.spyOn(accountResourceUsageDao, 'get').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
      vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.COMPLETED,
        ModelArtifacts: { S3ModelArtifacts: TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location },
        StoppingCondition: { MaxRuntimeInSeconds: 600 },
        TrainingTimeInSeconds: undefined,
      } as Awaited<ReturnType<(typeof sageMakerHelper)['getTrainingJob']>>);
      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
      updateProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
      vi.spyOn(jobFinalizer, 'writeTrainingLogsToS3');
      vi.spyOn(jobFinalizer, 'writeSimulationLogsToS3').mockImplementationOnce(() => Promise.resolve());

      await expect(jobFinalizer.finalizeJob(mockInitSubmissionContext)).resolves.toEqual(mockInitSubmissionContext);

      expect(updateAccountResourceUsageSpy).toHaveBeenCalledWith(
        { year: currentYear, month: currentMonth },
        { accountComputeMinutesQueued: 0, accountComputeMinutesUsed: 400 },
      );
      expect(deleteStreamSpy).toHaveBeenCalledWith(mockInitSubmissionContext.videoStream?.arn);
      expect(stopTrainingJobSpy).not.toHaveBeenCalled();
      expect(jobFinalizer.writeSimulationLogsToS3).toHaveBeenCalledWith(mockInitSubmissionContext);
      expect(jobFinalizer.writeTrainingLogsToS3).not.toHaveBeenCalled();
      expect(updateProfileSpy).toHaveBeenCalledWith(
        { profileId: mockInitSubmissionContext.profileId },
        { computeMinutesQueued: 90, computeMinutesUsed: 300 },
      );
    });

    it('should finalize job with unterminated sagemaker training job', async () => {
      vi.spyOn(accountResourceUsageDao, 'get').mockResolvedValueOnce(null);
      vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
      mockInitTrainingContext.trainingJob = {
        ...MOCK_INIT_TRAINING_CONTEXT.trainingJob,
        status: TrainingJobStatus.IN_PROGRESS,
      };
      stopTrainingJobSpy.mockResolvedValueOnce();
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.STOPPED,
        ModelArtifacts: { S3ModelArtifacts: TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location },
        StoppingCondition: undefined,
        TrainingTimeInSeconds: undefined,
      } as Awaited<ReturnType<(typeof sageMakerHelper)['getTrainingJob']>>);
      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_UNDEFINED_USAGE_AND_LIMITS);
      updateProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_UNDEFINED_USAGE_AND_LIMITS);
      vi.spyOn(jobFinalizer, 'writeTrainingLogsToS3').mockImplementationOnce(() => Promise.resolve());

      await expect(jobFinalizer.finalizeJob(mockInitTrainingContext)).resolves.toEqual(mockInitTrainingContext);

      expect(updateAccountResourceUsageSpy).not.toHaveBeenCalled();
      expect(deleteStreamSpy).toHaveBeenCalledWith(mockInitTrainingContext.videoStream?.arn);
      expect(stopTrainingJobSpy).toHaveBeenCalled();
      expect(updateProfileSpy).toHaveBeenCalledWith(
        { profileId: mockInitEvaluationContext.profileId },
        { computeMinutesQueued: 0, computeMinutesUsed: 0 },
      );
    });
  });

  describe('persistWorkflowData()', () => {
    beforeEach(() => {
      getJobSpy.mockResolvedValue({ ...TEST_TRAINING_ITEM, status: JobStatus.IN_PROGRESS });
    });

    it('should persist data for successful training job', async () => {
      mockInitTrainingContext.trainingJob = {
        ...MOCK_INIT_TRAINING_CONTEXT.trainingJob,
        modelArtifactS3Location: TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location,
      };

      await jobFinalizer.persistWorkflowData(mockInitTrainingContext);

      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitTrainingContext.modelId, profileId: mockInitTrainingContext.profileId },
        {
          status: ModelStatus.READY,
          'assetS3Locations.modelArtifactS3Location': mockInitTrainingContext.trainingJob?.modelArtifactS3Location,
        },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitTrainingContext.jobName,
          modelId: mockInitTrainingContext.modelId,
          profileId: mockInitTrainingContext.profileId,
          leaderboardId: mockInitTrainingContext.leaderboardId,
        },
        { status: JobStatus.COMPLETED, endTime: TEST_TIMESTAMP, videoStreamUrl: undefined },
      );
      expect(Object.keys(updateJobSpy.mock.lastCall?.[1] as object).includes('videoStreamUrl')).toBe(true);
      expect(persistEvaluationMetricsSpy).not.toHaveBeenCalled();
      expect(persistSubmissionStatsSpy).not.toHaveBeenCalled();
      expect(metricsLogger.logDeepRacerJob).toHaveBeenCalledWith({
        jobType: JobType.TRAINING,
        jobStatus: JobStatus.COMPLETED,
        modelId: expect.any(String),
        leaderboardId: undefined,
        sageMakerMinutes: expect.any(Number),
      });
    });

    it('should persist data for failed training job due to failed sagemaker job', async () => {
      mockInitTrainingContext.trainingJob = {
        ...MOCK_INIT_TRAINING_CONTEXT.trainingJob,
        status: TrainingJobStatus.FAILED,
      };

      await jobFinalizer.persistWorkflowData(mockInitTrainingContext);

      expect(verifyFailedTraining()).toBe(true);
    });

    it('should persist data for failed training job due to workflow error', async () => {
      mockInitTrainingContext.errorDetails = new Error('Failure');

      await jobFinalizer.persistWorkflowData(mockInitTrainingContext);

      expect(verifyFailedTraining()).toBe(true);
    });

    function verifyFailedTraining() {
      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitTrainingContext.modelId, profileId: mockInitTrainingContext.profileId },
        {
          status: ModelStatus.ERROR,
          'assetS3Locations.modelArtifactS3Location': mockInitTrainingContext.trainingJob?.modelArtifactS3Location,
        },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitTrainingContext.jobName,
          modelId: mockInitTrainingContext.modelId,
          profileId: mockInitTrainingContext.profileId,
          leaderboardId: mockInitTrainingContext.leaderboardId,
        },
        { status: JobStatus.FAILED, endTime: TEST_TIMESTAMP },
      );
      expect(persistEvaluationMetricsSpy).not.toHaveBeenCalled();
      expect(persistSubmissionStatsSpy).not.toHaveBeenCalled();
      return true;
    }

    it('should persist data for successful evaluation job', async () => {
      persistEvaluationMetricsSpy.mockResolvedValueOnce();

      await jobFinalizer.persistWorkflowData(mockInitEvaluationContext);

      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitEvaluationContext.modelId, profileId: mockInitEvaluationContext.profileId },
        { status: ModelStatus.READY },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitEvaluationContext.jobName,
          modelId: mockInitEvaluationContext.modelId,
          profileId: mockInitEvaluationContext.profileId,
          leaderboardId: mockInitEvaluationContext.leaderboardId,
        },
        { status: JobStatus.COMPLETED, endTime: TEST_TIMESTAMP },
      );
      expect(persistEvaluationMetricsSpy).toHaveBeenCalledWith(mockInitEvaluationContext);
      expect(persistSubmissionStatsSpy).not.toHaveBeenCalled();
    });

    it('should persist data for failed evaluation job due to failed sagemaker job', async () => {
      mockInitEvaluationContext.trainingJob = {
        ...MOCK_INIT_EVALUATION_CONTEXT.trainingJob,
        status: TrainingJobStatus.FAILED,
      };

      persistEvaluationMetricsSpy.mockResolvedValueOnce();

      await jobFinalizer.persistWorkflowData(mockInitEvaluationContext);

      expect(verifyFailedEvaluation()).toBe(true);
    });

    it('should persist data for failed evaluation job due to workflow error', async () => {
      mockInitEvaluationContext.errorDetails = new Error('Failure');

      persistEvaluationMetricsSpy.mockResolvedValueOnce();

      await jobFinalizer.persistWorkflowData(mockInitEvaluationContext);

      expect(verifyFailedEvaluation()).toBe(true);
    });

    function verifyFailedEvaluation() {
      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitEvaluationContext.modelId, profileId: mockInitEvaluationContext.profileId },
        { status: ModelStatus.READY },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitEvaluationContext.jobName,
          modelId: mockInitEvaluationContext.modelId,
          profileId: mockInitEvaluationContext.profileId,
          leaderboardId: mockInitEvaluationContext.leaderboardId,
        },
        { status: JobStatus.FAILED, endTime: TEST_TIMESTAMP },
      );
      expect(persistEvaluationMetricsSpy).toHaveBeenCalledWith(mockInitEvaluationContext);
      expect(persistSubmissionStatsSpy).not.toHaveBeenCalled();
      return true;
    }

    it('should persist data for successful submission job', async () => {
      persistSubmissionStatsSpy.mockResolvedValueOnce();

      await jobFinalizer.persistWorkflowData(mockInitSubmissionContext);

      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitSubmissionContext.modelId, profileId: mockInitSubmissionContext.profileId },
        { status: ModelStatus.READY },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitSubmissionContext.jobName,
          modelId: mockInitSubmissionContext.modelId,
          profileId: mockInitSubmissionContext.profileId,
          leaderboardId: mockInitSubmissionContext.leaderboardId,
        },
        { status: JobStatus.COMPLETED, endTime: TEST_TIMESTAMP },
      );
      expect(persistEvaluationMetricsSpy).not.toHaveBeenCalled();
      expect(persistSubmissionStatsSpy).toHaveBeenCalledWith(mockInitSubmissionContext);
    });

    it('should persist data for failed submission job due to failed sagemaker job', async () => {
      mockInitSubmissionContext.trainingJob = {
        ...MOCK_INIT_SUBMISSION_CONTEXT.trainingJob,
        status: TrainingJobStatus.FAILED,
      };

      persistSubmissionStatsSpy.mockResolvedValueOnce();

      await jobFinalizer.persistWorkflowData(mockInitSubmissionContext);

      expect(verifyFailedSubmission()).toBe(true);
    });

    it('should persist data for failed submission job due to workflow error', async () => {
      mockInitSubmissionContext.errorDetails = new Error('Failure');

      persistSubmissionStatsSpy.mockResolvedValueOnce();

      await jobFinalizer.persistWorkflowData(mockInitSubmissionContext);

      expect(verifyFailedSubmission()).toBe(true);
    });

    function verifyFailedSubmission() {
      expect(updateModelSpy).toHaveBeenCalledWith(
        { modelId: mockInitSubmissionContext.modelId, profileId: mockInitSubmissionContext.profileId },
        { status: ModelStatus.READY },
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitSubmissionContext.jobName,
          modelId: mockInitSubmissionContext.modelId,
          profileId: mockInitSubmissionContext.profileId,
          leaderboardId: mockInitSubmissionContext.leaderboardId,
        },
        { status: JobStatus.FAILED, endTime: TEST_TIMESTAMP },
      );
      expect(persistEvaluationMetricsSpy).not.toHaveBeenCalled();
      expect(persistSubmissionStatsSpy).toHaveBeenCalledWith(mockInitSubmissionContext);
      return true;
    }

    it('should gracefully handle error by not rejecting and updating workflowContext', async () => {
      const mockError = new Error('Failure');
      updateModelSpy.mockRejectedValueOnce(mockError);

      await expect(jobFinalizer.persistWorkflowData(mockInitTrainingContext)).resolves.not.toThrow();
      expect(mockInitTrainingContext.errorDetails).toEqual(mockError);

      mockInitTrainingContext = { ...MOCK_INIT_TRAINING_CONTEXT };
      updateJobSpy.mockRejectedValueOnce(mockError);

      await expect(jobFinalizer.persistWorkflowData(mockInitTrainingContext)).resolves.not.toThrow();
      expect(mockInitTrainingContext.errorDetails).toEqual(mockError);
    });

    it('should preserve CANCELED status and skip updates when job was canceled', async () => {
      getJobSpy.mockResolvedValueOnce({ ...TEST_TRAINING_ITEM, status: JobStatus.CANCELED });

      await jobFinalizer.persistWorkflowData(mockInitTrainingContext);

      expect(getJobSpy).toHaveBeenCalledWith({
        jobName: mockInitTrainingContext.jobName,
        modelId: mockInitTrainingContext.modelId,
        profileId: mockInitTrainingContext.profileId,
        leaderboardId: mockInitTrainingContext.leaderboardId,
      });
      expect(updateModelSpy).not.toHaveBeenCalled();
      expect(updateJobSpy).not.toHaveBeenCalled();
      expect(persistEvaluationMetricsSpy).not.toHaveBeenCalled();
      expect(persistSubmissionStatsSpy).not.toHaveBeenCalled();
    });
  });

  describe('persistEvaluationMetrics()', () => {
    it('should persist evaluation metrics', async () => {
      const getEvaluationMetricsSpy = vi
        .spyOn(modelPerformanceMetricsHelper, 'getEvaluationMetrics')
        .mockResolvedValueOnce(TEST_EVALUATION_ITEM.metrics);
      getJobSpy.mockResolvedValue(TEST_EVALUATION_ITEM);

      await jobFinalizer.persistEvaluationMetrics(mockInitEvaluationContext);

      expect(getEvaluationMetricsSpy).toHaveBeenCalledWith(TEST_EVALUATION_ITEM.assetS3Locations.metricsS3Location);
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitEvaluationContext.jobName,
          modelId: mockInitEvaluationContext.modelId,
          profileId: mockInitEvaluationContext.profileId,
        },
        { metrics: TEST_EVALUATION_ITEM.metrics },
      );
    });

    it('should gracefully handle error by not rejecting and updating workflowContext', async () => {
      const mockError = new Error('Failure');
      getJobSpy.mockResolvedValueOnce(TEST_EVALUATION_ITEM);
      vi.spyOn(modelPerformanceMetricsHelper, 'getEvaluationMetrics').mockResolvedValue(TEST_EVALUATION_ITEM.metrics);
      updateJobSpy.mockRejectedValueOnce(mockError);

      await expect(jobFinalizer.persistEvaluationMetrics(mockInitEvaluationContext)).resolves.not.toThrow();
      expect(mockInitEvaluationContext.errorDetails).toEqual(mockError);

      mockInitEvaluationContext = { ...MOCK_INIT_EVALUATION_CONTEXT };
      getJobSpy.mockRejectedValueOnce(mockError);

      await expect(jobFinalizer.persistEvaluationMetrics(mockInitEvaluationContext)).resolves.not.toThrow();
      expect(mockInitEvaluationContext.errorDetails).toEqual(mockError);
    });
  });

  describe('persistSubmissionStats()', () => {
    it('should persist stats for submission that had no completed laps', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 9,
        avgLapTime: INVALID_RANKING_SCORE,
        bestLapTime: INVALID_RANKING_SCORE,
        collisionCount: 0,
        completedLapCount: 0,
        offTrackCount: 0,
        resetCount: 9,
        totalLapTime: INVALID_RANKING_SCORE,
      };

      loadSubmissionSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);
      loadLeaderboardSpy.mockResolvedValueOnce(TEST_LEADERBOARD_ITEM);
      getSubmissionStatsSpy.mockResolvedValueOnce(mockSubmissionStats);

      await expect(jobFinalizer.persistSubmissionStats(mockInitSubmissionContext)).resolves.not.toThrow();

      expect(loadSubmissionSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
        submissionId: TEST_SUBMISSION_ITEM.submissionId,
      });
      expect(loadLeaderboardSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
      });
      expect(getSubmissionStatsSpy).toHaveBeenCalledWith(
        TEST_SUBMISSION_ITEM.assetS3Locations.metricsS3Location,
        TEST_LEADERBOARD_ITEM.minimumLaps,
      );
      expect(getRankingScoreSpy).toHaveBeenCalledWith(mockSubmissionStats, TEST_LEADERBOARD_ITEM.timingMethod);
      expect(updateSubmissionSpy).not.toHaveBeenCalled();
      expect(persistRankingStatsSpy).not.toHaveBeenCalled();
    });

    it('should persist stats for submission that had completed laps but did not meet leaderboard requirements', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 9,
        avgLapTime: INVALID_RANKING_SCORE,
        bestLapTime: 4500,
        collisionCount: 0,
        completedLapCount: 1,
        offTrackCount: 0,
        resetCount: 9,
        totalLapTime: 12000,
      };

      loadSubmissionSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);
      loadLeaderboardSpy.mockResolvedValueOnce(TEST_LEADERBOARD_ITEM);
      getSubmissionStatsSpy.mockResolvedValueOnce(mockSubmissionStats);
      updateSubmissionSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);

      await expect(jobFinalizer.persistSubmissionStats(mockInitSubmissionContext)).resolves.not.toThrow();

      expect(loadSubmissionSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
        submissionId: TEST_SUBMISSION_ITEM.submissionId,
      });
      expect(loadLeaderboardSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
      });
      expect(getSubmissionStatsSpy).toHaveBeenCalledWith(
        TEST_SUBMISSION_ITEM.assetS3Locations.metricsS3Location,
        TEST_LEADERBOARD_ITEM.minimumLaps,
      );
      expect(getRankingScoreSpy).toHaveBeenCalledWith(mockSubmissionStats, TEST_LEADERBOARD_ITEM.timingMethod);
      expect(updateSubmissionSpy).toHaveBeenCalledWith(
        {
          leaderboardId: mockInitSubmissionContext.leaderboardId,
          profileId: mockInitSubmissionContext.profileId,
          submissionId: TEST_SUBMISSION_ITEM.submissionId,
        },
        { stats: mockSubmissionStats, rankingScore: undefined },
      );
      expect(persistRankingStatsSpy).not.toHaveBeenCalled();
    });

    it('should persist stats for submission that had completed laps and met leaderboard requirements', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 9,
        avgLapTime: 5000,
        bestLapTime: 4500,
        collisionCount: 0,
        completedLapCount: 2,
        offTrackCount: 0,
        resetCount: 9,
        totalLapTime: 12000,
      };

      loadSubmissionSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);
      loadLeaderboardSpy.mockResolvedValueOnce(TEST_LEADERBOARD_ITEM);
      getSubmissionStatsSpy.mockResolvedValueOnce(mockSubmissionStats);
      updateSubmissionSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);
      persistRankingStatsSpy.mockResolvedValueOnce();

      await expect(jobFinalizer.persistSubmissionStats(mockInitSubmissionContext)).resolves.not.toThrow();

      expect(loadSubmissionSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
        submissionId: TEST_SUBMISSION_ITEM.submissionId,
      });
      expect(loadLeaderboardSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
      });
      expect(getSubmissionStatsSpy).toHaveBeenCalledWith(
        TEST_SUBMISSION_ITEM.assetS3Locations.metricsS3Location,
        TEST_LEADERBOARD_ITEM.minimumLaps,
      );
      expect(getRankingScoreSpy).toHaveBeenCalledWith(mockSubmissionStats, TEST_LEADERBOARD_ITEM.timingMethod);
      expect(updateSubmissionSpy).toHaveBeenCalledWith(
        {
          leaderboardId: mockInitSubmissionContext.leaderboardId,
          profileId: mockInitSubmissionContext.profileId,
          submissionId: TEST_SUBMISSION_ITEM.submissionId,
        },
        { stats: mockSubmissionStats, rankingScore: mockSubmissionStats.avgLapTime },
      );
      expect(persistRankingStatsSpy).toHaveBeenCalledWith(
        mockInitSubmissionContext,
        mockSubmissionStats,
        mockSubmissionStats.avgLapTime,
        TEST_SUBMISSION_ITEM,
        TEST_LEADERBOARD_ITEM,
      );
    });

    it('should gracefully handle error by not rejecting and updating workflowContext', async () => {
      const mockError = new Error('Failure');
      loadSubmissionSpy.mockRejectedValueOnce(mockError);
      loadLeaderboardSpy.mockResolvedValueOnce(TEST_LEADERBOARD_ITEM);

      await expect(jobFinalizer.persistSubmissionStats(mockInitSubmissionContext)).resolves.not.toThrow();
      expect(mockInitSubmissionContext.errorDetails).toEqual(mockError);
    });
  });

  describe('persistRankingStats()', () => {
    it('should create ranking for submission with no previous ranking', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 0,
        avgLapTime: 10000,
        bestLapTime: 9000,
        collisionCount: 0,
        completedLapCount: 2,
        offTrackCount: 0,
        resetCount: 0,
        totalLapTime: 20000,
      };

      getRankingSpy.mockResolvedValueOnce(null);
      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      createRankingSpy.mockResolvedValueOnce(TEST_RANKING_ITEM);
      updateLeaderboardSpy.mockResolvedValueOnce(TEST_LEADERBOARD_ITEM);

      await expect(
        jobFinalizer.persistRankingStats(
          mockInitSubmissionContext,
          mockSubmissionStats,
          mockSubmissionStats.avgLapTime,
          TEST_SUBMISSION_ITEM,
          TEST_LEADERBOARD_ITEM,
        ),
      ).resolves.not.toThrow();

      expect(getRankingSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
      });
      expect(loadProfileSpy).toHaveBeenCalledWith({ profileId: mockInitSubmissionContext.profileId });
      expect(createRankingSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
        modelId: mockInitSubmissionContext.modelId,
        modelName: TEST_SUBMISSION_ITEM.modelName,
        rankingScore: mockSubmissionStats.avgLapTime,
        stats: mockSubmissionStats,
        submissionId: TEST_SUBMISSION_ITEM.submissionId,
        submissionNumber: TEST_SUBMISSION_ITEM.submissionNumber,
        submissionVideoS3Location: TEST_SUBMISSION_ITEM.assetS3Locations.primaryVideoS3Location,
        userProfile: { alias: TEST_PROFILE_ITEM.alias, avatar: TEST_PROFILE_ITEM.avatar },
      });
      expect(updateLeaderboardSpy).toHaveBeenCalledWith(
        { leaderboardId: mockInitSubmissionContext.leaderboardId },
        { participantCount: TEST_LEADERBOARD_ITEM.participantCount + 1 },
      );
      expect(updateRankingSpy).not.toHaveBeenCalled();
    });

    it('should update ranking for submission with worse previous ranking', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 0,
        avgLapTime: TEST_RANKING_ITEM.rankingScore - 500,
        bestLapTime: 9000,
        collisionCount: 0,
        completedLapCount: 2,
        offTrackCount: 0,
        resetCount: 0,
        totalLapTime: 20000,
      };

      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);
      getRankingSpy.mockResolvedValueOnce(TEST_RANKING_ITEM);
      updateRankingSpy.mockResolvedValueOnce(TEST_RANKING_ITEM);

      await expect(
        jobFinalizer.persistRankingStats(
          mockInitSubmissionContext,
          mockSubmissionStats,
          mockSubmissionStats.avgLapTime,
          TEST_SUBMISSION_ITEM,
          TEST_LEADERBOARD_ITEM,
        ),
      ).resolves.not.toThrow();

      expect(getRankingSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
      });
      expect(loadProfileSpy).toHaveBeenCalledWith({ profileId: mockInitSubmissionContext.profileId });
      expect(createRankingSpy).not.toHaveBeenCalled();
      expect(updateLeaderboardSpy).not.toHaveBeenCalled();
      expect(updateRankingSpy).toHaveBeenCalledWith(
        { leaderboardId: mockInitSubmissionContext.leaderboardId, profileId: mockInitSubmissionContext.profileId },
        {
          modelName: TEST_SUBMISSION_ITEM.modelName,
          modelId: mockInitSubmissionContext.modelId,
          rankingScore: mockSubmissionStats.avgLapTime,
          stats: mockSubmissionStats,
          submissionId: TEST_SUBMISSION_ITEM.submissionId,
          submissionNumber: TEST_SUBMISSION_ITEM.submissionNumber,
          submissionVideoS3Location: TEST_SUBMISSION_ITEM.assetS3Locations.primaryVideoS3Location,
          userProfile: { alias: TEST_PROFILE_ITEM.alias, avatar: TEST_PROFILE_ITEM.avatar },
        },
      );
    });

    it('should not update ranking for submission with better previous ranking', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 0,
        avgLapTime: TEST_RANKING_ITEM.rankingScore + 500,
        bestLapTime: 9000,
        collisionCount: 0,
        completedLapCount: 2,
        offTrackCount: 0,
        resetCount: 0,
        totalLapTime: 20000,
      };

      getRankingSpy.mockResolvedValueOnce(TEST_RANKING_ITEM);
      loadProfileSpy.mockResolvedValueOnce(TEST_PROFILE_ITEM);

      await expect(
        jobFinalizer.persistRankingStats(
          mockInitSubmissionContext,
          mockSubmissionStats,
          mockSubmissionStats.avgLapTime,
          TEST_SUBMISSION_ITEM,
          TEST_LEADERBOARD_ITEM,
        ),
      ).resolves.not.toThrow();

      expect(getRankingSpy).toHaveBeenCalledWith({
        leaderboardId: mockInitSubmissionContext.leaderboardId,
        profileId: mockInitSubmissionContext.profileId,
      });
      expect(loadProfileSpy).toHaveBeenCalledWith({ profileId: mockInitSubmissionContext.profileId });
      expect(createRankingSpy).not.toHaveBeenCalled();
      expect(updateLeaderboardSpy).not.toHaveBeenCalled();
      expect(updateRankingSpy).not.toHaveBeenCalled();
    });

    it('should gracefully handle error by not rejecting and updating workflowContext', async () => {
      const mockSubmissionStats: SubmissionStats = {
        avgResets: 0,
        avgLapTime: TEST_RANKING_ITEM.rankingScore + 500,
        bestLapTime: 9000,
        collisionCount: 0,
        completedLapCount: 2,
        offTrackCount: 0,
        resetCount: 0,
        totalLapTime: 20000,
      };
      const mockError = new Error('Failure');
      loadProfileSpy.mockRejectedValueOnce(mockError);
      getRankingSpy.mockResolvedValueOnce(null);

      await expect(
        jobFinalizer.persistRankingStats(
          mockInitSubmissionContext,
          mockSubmissionStats,
          mockSubmissionStats.avgLapTime,
          TEST_SUBMISSION_ITEM,
          TEST_LEADERBOARD_ITEM,
        ),
      ).resolves.not.toThrow();
      expect(mockInitSubmissionContext.errorDetails).toEqual(mockError);
    });
  });

  describe('writeTrainingLogsToS3()', () => {
    const mockTrainingLogsS3Location = 'mock-training-logs-location';
    const mockSimulationLogsS3Location = 'mock-simulation-logs-location';

    it('should write training and simulation logs to S3', async () => {
      vi.mocked(s3PathHelper.getLogsS3Location).mockReturnValueOnce(mockTrainingLogsS3Location);
      vi.mocked(s3PathHelper.getLogsS3Location).mockReturnValueOnce(mockSimulationLogsS3Location);

      await jobFinalizer.writeTrainingLogsToS3(mockInitTrainingContext);

      expect(cloudWatchLogsHelper.writeLogStreamToS3).toHaveBeenCalledWith(
        TRAINING_TRAINING_LOG_GROUP,
        mockInitTrainingContext.jobName,
        mockTrainingLogsS3Location,
      );
      expect(cloudWatchLogsHelper.writeLogStreamToS3).toHaveBeenCalledWith(
        TRAINING_SIMULATION_LOG_GROUP,
        mockInitTrainingContext.jobName,
        mockSimulationLogsS3Location,
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitTrainingContext.jobName,
          modelId: mockInitTrainingContext.modelId,
          profileId: mockInitTrainingContext.profileId,
        },
        {
          'assetS3Locations.trainingLogsS3Location': mockTrainingLogsS3Location,
          'assetS3Locations.simulationLogsS3Location': mockSimulationLogsS3Location,
        },
      );
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('S3 write error');
      vi.mocked(cloudWatchLogsHelper.writeLogStreamToS3).mockRejectedValueOnce(mockError);

      await expect(jobFinalizer.writeTrainingLogsToS3(mockInitTrainingContext)).resolves.not.toThrow();
    });
  });

  describe('writeSimulationLogsToS3()', () => {
    const mockSimulationLogsS3Location = 'mock-simulation-logs-location';

    it('should write simulation logs to S3', async () => {
      vi.mocked(s3PathHelper.getLogsS3Location).mockReturnValueOnce(mockSimulationLogsS3Location);

      await jobFinalizer.writeSimulationLogsToS3(mockInitSubmissionContext);

      expect(cloudWatchLogsHelper.writeLogStreamToS3).toHaveBeenCalledWith(
        EVALUATION_SIMULATION_LOG_GROUP,
        mockInitSubmissionContext.jobName,
        mockSimulationLogsS3Location,
      );
      expect(updateJobSpy).toHaveBeenCalledWith(
        {
          jobName: mockInitSubmissionContext.jobName,
          modelId: mockInitSubmissionContext.modelId,
          profileId: mockInitSubmissionContext.profileId,
          leaderboardId: mockInitSubmissionContext.leaderboardId,
        },
        {
          'assetS3Locations.simulationLogsS3Location': mockSimulationLogsS3Location,
        },
      );
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('S3 write error');
      vi.mocked(cloudWatchLogsHelper.writeLogStreamToS3).mockRejectedValueOnce(mockError);
      await expect(jobFinalizer.writeSimulationLogsToS3(mockInitEvaluationContext)).resolves.not.toThrow();
    });
  });
});
