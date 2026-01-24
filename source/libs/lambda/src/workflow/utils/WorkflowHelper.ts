// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  evaluationDao,
  EvaluationItem,
  JobItem,
  JobName,
  jobNameHelper,
  JobType,
  ResourceId,
  submissionDao,
  SubmissionItem,
  trainingDao,
  TrainingItem,
} from '@deepracer-indy/database';

import type { UpdateJobIdentifiers, UpdatedJobAttributes, UpdateJobFn } from '../types/updateJob.js';

class WorkflowHelper {
  /**
   * Determines if the given job is an {@link EvaluationItem}.
   *
   * @param jobItem The job DDB item to check
   * @returns A boolean
   */
  isEvaluation(jobItem: JobItem): jobItem is EvaluationItem {
    return !!(jobItem as EvaluationItem).evaluationId;
  }

  /**
   * Determines if the given job is a {@link SubmissionItem}.
   *
   * @param jobItem The job DDB item to check
   * @returns A boolean
   */
  isSubmission(jobItem: JobItem): jobItem is SubmissionItem {
    return !!(jobItem as SubmissionItem).submissionId;
  }

  /**
   * Determines if the given job item is a {@link TrainingItem}.
   *
   * @param jobItem The job DDB item to check
   * @returns A boolean
   */
  isTraining(jobItem: JobItem): jobItem is TrainingItem {
    return !this.isEvaluation(jobItem) && !this.isSubmission(jobItem);
  }

  /**
   * Retrieves a job from DDB.
   *
   * The job name is used to determine the job type, and therefore which job DAO to use for retrieval.
   *
   * @param jobIdentifiers The properties used to identify the job to retrieve
   * @returns A workflow job DDB item
   */
  getJob(jobIdentifiers: { jobName: JobName; modelId: ResourceId; profileId: ResourceId; leaderboardId?: ResourceId }) {
    const { jobName, modelId, profileId, leaderboardId } = jobIdentifiers;
    switch (jobNameHelper.getJobType(jobName)) {
      case JobType.TRAINING:
        return trainingDao.load({ modelId });
      case JobType.EVALUATION:
        return evaluationDao.load({ modelId, evaluationId: jobNameHelper.getJobId(jobName) });
      case JobType.SUBMISSION:
        return submissionDao.load({
          profileId,
          submissionId: jobNameHelper.getJobId(jobName),
          leaderboardId: leaderboardId as ResourceId,
        });
      default:
        throw new Error('Invalid job type');
    }
  }

  /**
   * Updates a job in DDB.
   *
   * This method has overloads to allow updating any type of job, and for making
   * updates to common job properties when the specific job type is unknown or unimportant.
   *
   * @param jobIdentifiers The properties used to identify the job to update
   * @param updatedAttributes The attributes and associated values to update
   */
  updateJob<JT extends JobType.TRAINING>(
    jobIdentifiers: UpdateJobIdentifiers<JT>,
    updatedAttributes: UpdatedJobAttributes<JT>,
  ): ReturnType<UpdateJobFn[JT]>;
  updateJob<JT extends JobType.EVALUATION>(
    jobIdentifiers: UpdateJobIdentifiers<JT>,
    updatedAttributes: UpdatedJobAttributes<JT>,
  ): ReturnType<UpdateJobFn[JT]>;
  updateJob<JT extends JobType.SUBMISSION>(
    jobIdentifiers: UpdateJobIdentifiers<JT>,
    updatedAttributes: UpdatedJobAttributes<JT>,
  ): ReturnType<UpdateJobFn[JT]>;
  updateJob<JT extends JobType>(
    jobIdentifiers: UpdateJobIdentifiers<JT>,
    updatedAttributes: UpdatedJobAttributes<JT>,
  ): ReturnType<UpdateJobFn[JT]>;
  updateJob<JT extends JobType>(jobIdentifiers: UpdateJobIdentifiers<JT>, updatedAttributes: UpdatedJobAttributes<JT>) {
    const { jobName, modelId, profileId, leaderboardId } = jobIdentifiers;
    switch (jobNameHelper.getJobType(jobName)) {
      case JobType.TRAINING:
        return trainingDao.update({ modelId: modelId as ResourceId }, updatedAttributes);
      case JobType.EVALUATION:
        return evaluationDao.update(
          { modelId: modelId as ResourceId, evaluationId: jobNameHelper.getJobId(jobName) },
          updatedAttributes as UpdatedJobAttributes<JobType.EVALUATION>,
        );
      case JobType.SUBMISSION:
        return submissionDao.update(
          {
            leaderboardId: leaderboardId as ResourceId,
            profileId: profileId as ResourceId,
            submissionId: jobNameHelper.getJobId(jobName),
          },
          updatedAttributes,
        );
      default:
        throw new Error('Invalid job type');
    }
  }
}

export const workflowHelper = new WorkflowHelper();
