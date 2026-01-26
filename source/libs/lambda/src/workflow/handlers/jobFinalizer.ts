// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */

import { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import {
  jobNameHelper,
  JobType,
  leaderboardDao,
  LeaderboardItem,
  modelDao,
  profileDao,
  rankingDao,
  s3PathHelper,
  submissionDao,
  SubmissionItem,
} from '@deepracer-indy/database';
import { JobStatus, ModelStatus, SubmissionStats } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod, metrics, metricsLogger, waitForAll } from '@deepracer-indy/utils';

import { cloudWatchLogsHelper } from '../../utils/CloudWatchLogsHelper.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { usageQuotaHelper } from '../../utils/UsageQuotaHelper.js';
import { INVALID_RANKING_SCORE } from '../constants/rankingScore.js';
import { SAGEMAKER_COMPLETED_JOB_STATUSES } from '../constants/sageMaker.js';
import {
  EVALUATION_SIMULATION_LOG_GROUP,
  TRAINING_SIMULATION_LOG_GROUP,
  TRAINING_TRAINING_LOG_GROUP,
} from '../constants/simulation.js';
import type { WorkflowContext } from '../types/workflowContext.js';
import type { WorkflowTaskHandler } from '../types/workflowTaskHandler.js';
import { kinesisVideoStreamHelper } from '../utils/KinesisVideoStreamHelper.js';
import { modelPerformanceMetricsHelper } from '../utils/ModelPerformanceMetricsHelper.js';
import { sageMakerHelper } from '../utils/SageMakerHelper.js';
import { workflowHelper } from '../utils/WorkflowHelper.js';

class JobFinalizer implements WorkflowTaskHandler {
  private minutesUsedBySageMaker = 0;

  handler = async (workflowContext: WorkflowContext) => {
    try {
      await this.finalizeJob(workflowContext);
    } catch (error) {
      workflowContext.errorDetails = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } finally {
      await this.persistWorkflowData(workflowContext);
    }

    return workflowContext;
  };

  @logMethod
  async finalizeJob(workflowContext: WorkflowContext) {
    const { jobName, videoStream, trainingJob, profileId } = workflowContext;
    const jobType = jobNameHelper.getJobType(jobName);

    if (videoStream?.arn) {
      logger.info(`Deleting KVS stream: ${videoStream?.name}`);
      await kinesisVideoStreamHelper.deleteStream(videoStream.arn);
    }

    // If training job was not created we can exit early.
    if (!trainingJob?.name) {
      return workflowContext;
    }

    // Final check for unterminated SageMaker job (only possible in the case of an unexpected error in JobMonitor)
    if (!trainingJob.status || trainingJob.status === TrainingJobStatus.IN_PROGRESS) {
      logger.info(`TrainingJob ${trainingJob.name} in non-terminal state ${trainingJob.status}, terminating`);
      await sageMakerHelper.stopTrainingJob(trainingJob.name);
      trainingJob.status = TrainingJobStatus.STOPPED;
    }

    const { ModelArtifacts, StoppingCondition, TrainingTimeInSeconds } = await sageMakerHelper.getTrainingJob(
      trainingJob.name,
    );

    if (jobType === JobType.TRAINING && SAGEMAKER_COMPLETED_JOB_STATUSES.includes(trainingJob.status)) {
      trainingJob.modelArtifactS3Location = ModelArtifacts?.S3ModelArtifacts;
    }

    if (jobType === JobType.TRAINING) {
      await this.writeTrainingLogsToS3(workflowContext);
    } else {
      await this.writeSimulationLogsToS3(workflowContext);
    }

    const minutesQueuedByUser =
      StoppingCondition?.MaxRuntimeInSeconds !== undefined ? StoppingCondition?.MaxRuntimeInSeconds / 60 : 0;
    const minutesUsedBySageMaker = TrainingTimeInSeconds !== undefined ? TrainingTimeInSeconds / 60 : 0;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    await usageQuotaHelper.finalizeAccountComputeUsage(
      currentYear,
      currentMonth,
      minutesQueuedByUser,
      minutesUsedBySageMaker,
    );
    await usageQuotaHelper.finalizeProfileComputeUsage(profileId, minutesQueuedByUser, minutesUsedBySageMaker);
    this.minutesUsedBySageMaker = minutesQueuedByUser;
    return workflowContext;
  }

  async writeTrainingLogsToS3(workflowContext: WorkflowContext) {
    const { modelId, profileId, jobName } = workflowContext;

    try {
      logger.info('Writing training logs to S3');

      const trainingLogsS3Location = s3PathHelper.getLogsS3Location(modelId, profileId, jobName, 'training');
      const simulationLogsS3Location = s3PathHelper.getLogsS3Location(modelId, profileId, jobName, 'simulation');

      await waitForAll([
        cloudWatchLogsHelper.writeLogStreamToS3(TRAINING_TRAINING_LOG_GROUP, jobName, trainingLogsS3Location),
        cloudWatchLogsHelper.writeLogStreamToS3(TRAINING_SIMULATION_LOG_GROUP, jobName, simulationLogsS3Location),
      ]);

      await workflowHelper.updateJob(
        { jobName, modelId, profileId },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['assetS3Locations.trainingLogsS3Location' as any]: trainingLogsS3Location,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['assetS3Locations.simulationLogsS3Location' as any]: simulationLogsS3Location,
        },
      );
    } catch (error) {
      logger.error('Error writing training logs to S3', { error });
    }
  }

  async writeSimulationLogsToS3(workflowContext: WorkflowContext) {
    const { modelId, profileId, jobName, leaderboardId } = workflowContext;

    try {
      logger.info('Writing simulation logs to S3');

      const simulationLogsS3Location = s3PathHelper.getLogsS3Location(modelId, profileId, jobName, 'simulation');

      await cloudWatchLogsHelper.writeLogStreamToS3(EVALUATION_SIMULATION_LOG_GROUP, jobName, simulationLogsS3Location);

      await workflowHelper.updateJob(
        { jobName, modelId, profileId, leaderboardId },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['assetS3Locations.simulationLogsS3Location' as any]: simulationLogsS3Location,
        },
      );
    } catch (error) {
      logger.error('Error writing simulation logs to S3', { error });
    }
  }

  async persistWorkflowData(workflowContext: WorkflowContext) {
    const { jobName, trainingJob, leaderboardId, modelId, profileId } = workflowContext;
    // refresh the job status as jobs can be cancelled after dispatch
    const currentJob = await workflowHelper.getJob({ jobName, modelId, profileId, leaderboardId });
    if (currentJob.status === JobStatus.CANCELED) {
      logger.info('Job was canceled, preserving CANCELED status');
      return;
    }

    let jobStatus: JobStatus = JobStatus.COMPLETED;

    try {
      const jobType = jobNameHelper.getJobType(jobName);

      if (jobType === JobType.EVALUATION) {
        await this.persistEvaluationMetrics(workflowContext as WorkflowContext<JobType.EVALUATION>);
      }
      if (jobType === JobType.SUBMISSION) {
        await this.persistSubmissionStats(workflowContext as WorkflowContext<JobType.SUBMISSION>);
      }

      let modelStatus: ModelStatus = ModelStatus.READY;

      if (workflowContext.errorDetails || trainingJob?.status === TrainingJobStatus.FAILED) {
        jobStatus = JobStatus.FAILED;
        modelStatus = jobType === JobType.TRAINING ? ModelStatus.ERROR : ModelStatus.READY;
      }

      await waitForAll([
        modelDao.update(
          { modelId, profileId },
          {
            status: modelStatus,
            ...(jobType === JobType.TRAINING && {
              // Typecast to any is required due to an issue with ElectroDB's types
              ['assetS3Locations.modelArtifactS3Location' as any]: trainingJob?.modelArtifactS3Location, // eslint-disable-line @typescript-eslint/no-explicit-any
            }),
          },
        ),
        workflowHelper.updateJob(
          { jobName, modelId, profileId, leaderboardId },
          { status: jobStatus, endTime: new Date().toISOString(), videoStreamUrl: undefined },
        ),
      ]);
    } catch (error) {
      logger.error('Error persisting workflow data', { error });
      workflowContext.errorDetails = error as Error;
    } finally {
      metricsLogger.logDeepRacerJob({
        jobType: jobNameHelper.getJobType(jobName),
        jobStatus,
        modelId,
        leaderboardId,
        sageMakerMinutes: this.minutesUsedBySageMaker,
      });

      // Publish job outcome metric to CloudWatch using Lambda Powertools
      // The logMetrics middleware will automatically publish at the end of Lambda execution
      metrics.addMetric('JobOutcome', 'Count', 1);
      metrics.addDimension('JobType', jobNameHelper.getJobType(jobName));
      metrics.addDimension('JobStatus', jobStatus);
    }
  }

  async persistEvaluationMetrics(workflowContext: WorkflowContext<JobType.EVALUATION>) {
    const { jobName, modelId, profileId } = workflowContext;

    try {
      const {
        assetS3Locations: { metricsS3Location },
      } = await workflowHelper.getJob({ jobName, modelId, profileId });

      const evaluationMetrics = await modelPerformanceMetricsHelper.getEvaluationMetrics(metricsS3Location);

      await workflowHelper.updateJob({ jobName, modelId, profileId }, { metrics: evaluationMetrics });
    } catch (error) {
      logger.error('Error persisting evaluation metrics', { error });
      workflowContext.errorDetails = error as Error;
    }
  }

  async persistSubmissionStats(workflowContext: WorkflowContext<JobType.SUBMISSION>) {
    const { jobName, leaderboardId, profileId } = workflowContext;

    try {
      const submissionId = jobNameHelper.getJobId(jobName);

      const [submissionItem, leaderboardItem] = await waitForAll([
        submissionDao.load({ leaderboardId, profileId, submissionId }),
        leaderboardDao.load({ leaderboardId }),
      ]);

      const stats = await modelPerformanceMetricsHelper.getSubmissionStats(
        submissionItem.assetS3Locations.metricsS3Location,
        leaderboardItem.minimumLaps,
      );
      const rankingScore = modelPerformanceMetricsHelper.getRankingScore(stats, leaderboardItem.timingMethod);

      if (stats.completedLapCount > 0) {
        logger.info('Submission has completed laps, updating submission performance.', {
          completedLapCount: stats.completedLapCount,
        });
        await submissionDao.update(
          { leaderboardId, profileId, submissionId },
          { rankingScore: rankingScore === INVALID_RANKING_SCORE ? undefined : rankingScore, stats },
        );
      } else {
        logger.info('Submission has no completed laps, not updating submission performance.');
      }

      if (stats.completedLapCount >= leaderboardItem.minimumLaps) {
        logger.info('Submission met leaderboard requirements, performing ranking handling.', {
          completedLapCount: stats.completedLapCount,
          minimumLaps: leaderboardItem.minimumLaps,
        });
        await this.persistRankingStats(workflowContext, stats, rankingScore, submissionItem, leaderboardItem);
      } else {
        logger.info('Submission did not meet leaderboard requirements, skipping ranking handling.', {
          completedLapCount: stats.completedLapCount,
          minimumLaps: leaderboardItem.minimumLaps,
        });
      }
    } catch (error) {
      logger.error('Error persisting submission stats.', { error });
      workflowContext.errorDetails = error as Error;
    }
  }

  async persistRankingStats(
    workflowContext: WorkflowContext<JobType.SUBMISSION>,
    stats: SubmissionStats,
    rankingScore: number,
    submissionItem: SubmissionItem,
    leaderboardItem: LeaderboardItem,
  ) {
    const { modelId, leaderboardId, profileId } = workflowContext;

    try {
      const [rankingItem, profileItem] = await waitForAll([
        rankingDao.get({ leaderboardId, profileId }),
        profileDao.load({ profileId }),
      ]);

      if (!rankingItem) {
        logger.info('No ranking found for user, creating ranking.', { profileId, leaderboardId });
        await rankingDao.create({
          leaderboardId,
          profileId,
          modelId,
          rankingScore,
          stats,
          modelName: submissionItem.modelName,
          submissionId: submissionItem.submissionId,
          submissionNumber: submissionItem.submissionNumber,
          submissionVideoS3Location: submissionItem.assetS3Locations.primaryVideoS3Location,
          userProfile: { alias: profileItem.alias, avatar: profileItem.avatar },
        });
        await leaderboardDao.update({ leaderboardId }, { participantCount: leaderboardItem.participantCount + 1 });
      } else if (rankingScore < rankingItem.rankingScore) {
        logger.info('Submission rankingScore is better than ranking rankingScore, updating ranking.', {
          profileId,
          leaderboardId,
          submissionRankingScore: rankingScore,
          rankingRankingScore: rankingItem.rankingScore,
        });
        await rankingDao.update(
          { leaderboardId, profileId },
          {
            modelId,
            rankingScore,
            stats,
            modelName: submissionItem.modelName,
            submissionId: submissionItem.submissionId,
            submissionNumber: submissionItem.submissionNumber,
            submissionVideoS3Location: submissionItem.assetS3Locations.primaryVideoS3Location,
            userProfile: { alias: profileItem.alias, avatar: profileItem.avatar },
          },
        );
      } else {
        logger.info('Submission rankingScore is worse than ranking rankingScore, not updating ranking.', {
          profileId,
          leaderboardId,
          submissionRankingScore: rankingScore,
          rankingRankingScore: rankingItem.rankingScore,
        });
      }
    } catch (error) {
      logger.error('Error persisting ranking stats.', { error });
      workflowContext.errorDetails = error as Error;
    }
  }
}

export const jobFinalizer = new JobFinalizer();
export const lambdaHandler = instrumentHandler(jobFinalizer.handler);
