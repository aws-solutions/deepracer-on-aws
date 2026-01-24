// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { evaluationDao, JobItem, modelDao, ResourceId, submissionDao, trainingDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  getStopModelHandler,
  InternalFailureError,
  JobStatus,
  ModelStatus,
  StopModelServerInput,
  StopModelServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, waitForAll } from '@deepracer-indy/utils';

import { sageMakerHelper } from '../../workflow/utils/SageMakerHelper.js';
import { workflowHelper } from '../../workflow/utils/WorkflowHelper.js';
import { ErrorMessage } from '../constants/errorMessages.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** This is the implementation of business logic of the StopModel operation. */
export const StopModelOperation: Operation<StopModelServerInput, StopModelServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const modelId = input.modelId as ResourceId;
  const profileId = context.profileId;

  logger.debug('StopModel operation started', { modelId, profileId });

  const modelItem = await modelDao.load({ profileId, modelId });
  logger.debug('Model loaded', { modelId, modelStatus: modelItem.status });

  let stoppableJob: JobItem | null;

  switch (modelItem.status) {
    case ModelStatus.EVALUATING:
      logger.debug('Model is EVALUATING, fetching stoppable evaluation');
      stoppableJob = await evaluationDao.getStoppableEvaluation(modelId);
      break;
    case ModelStatus.QUEUED: {
      logger.debug('Model is QUEUED, checking for stoppable jobs');
      const [stoppableEvaluation, stoppableSubmission, stoppableTraining] = await waitForAll([
        evaluationDao.getStoppableEvaluation(modelId),
        submissionDao.getStoppableSubmission(modelId, profileId),
        trainingDao.getStoppableTraining(modelId),
      ]);
      stoppableJob = stoppableEvaluation ?? stoppableSubmission ?? stoppableTraining;
      logger.debug('Stoppable job search complete', {
        hasEvaluation: !!stoppableEvaluation,
        hasSubmission: !!stoppableSubmission,
        hasTraining: !!stoppableTraining,
        selectedJob: stoppableJob?.name,
      });
      break;
    }
    case ModelStatus.TRAINING:
      logger.debug('Model is TRAINING, fetching stoppable training');
      stoppableJob = await trainingDao.getStoppableTraining(modelId);
      break;
    default:
      logger.warn('Model is not in a stoppable state', { modelStatus: modelItem.status });
      throw new BadRequestError({ message: 'Model is not in a stoppable state.' });
  }

  if (!stoppableJob) {
    logger.error(`Unable to find stoppable job for model in stoppable status: ${modelItem.status}`, { modelItem });
    throw new InternalFailureError({ message: ErrorMessage.INTERNAL_SERVICE_ERROR });
  }

  logger.debug('Stoppable job found', { jobName: stoppableJob.name, jobStatus: stoppableJob.status });

  let jobStatus: JobStatus;
  let modelStatus: ModelStatus;

  switch (stoppableJob.status) {
    case JobStatus.INITIALIZING:
      logger.warn('Job is INITIALIZING, cannot stop during initialization', { jobName: stoppableJob.name });
      /**
       * Disallowing stopping jobs during initialization to prevent "completed" jobs with no valid sagemaker output.
       * This can be changed later if appropriate handling and cleanup is added in workflow and website.
       */
      throw new BadRequestError({ message: 'Model cannot be stopped during job initialization.' });
    case JobStatus.IN_PROGRESS:
      logger.debug('Job is IN_PROGRESS, stopping SageMaker job', { jobName: stoppableJob.name });
      /**
       * If the job is IN_PROGRESS, we set model and job to STOPPING and stop the SageMaker job.
       * The workflow will finalize the job and set final statuses once completed.
       */
      jobStatus = JobStatus.STOPPING;
      modelStatus = ModelStatus.STOPPING;
      await sageMakerHelper.stopTrainingJob(stoppableJob.name);
      logger.debug('SageMaker job stop command sent', { jobName: stoppableJob.name });
      break;
    case JobStatus.QUEUED:
      logger.debug('Job is QUEUED, canceling job', { jobName: stoppableJob.name });
      /**
       * If job is QUEUED, we set final statuses at this point since the job
       * will terminate at the JobDispatcher and never reach the workflow.
       */
      jobStatus = JobStatus.CANCELED;
      modelStatus = workflowHelper.isTraining(stoppableJob) ? ModelStatus.ERROR : ModelStatus.READY;
      await sageMakerHelper.stopQueuedJob(stoppableJob.name);
      logger.debug('Job canceled, setting final statuses', { jobStatus, modelStatus });
      break;
    default:
      // This should not be possible
      logger.error('Invalid status for stoppable job.', { job: stoppableJob });
      throw new InternalFailureError({ message: ErrorMessage.INTERNAL_SERVICE_ERROR });
  }

  logger.debug('Updating model and job statuses', { modelStatus, jobStatus, jobName: stoppableJob.name });

  await waitForAll([
    modelDao.update({ modelId, profileId }, { status: modelStatus }),
    workflowHelper.updateJob(
      {
        modelId,
        profileId,
        jobName: stoppableJob.name,
        leaderboardId: workflowHelper.isSubmission(stoppableJob) ? stoppableJob.leaderboardId : undefined,
      },
      { status: jobStatus },
    ),
  ]);

  logger.debug('StopModel operation completed successfully', { modelId, modelStatus, jobStatus });

  return {} satisfies StopModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getStopModelHandler(instrumentOperation(StopModelOperation)));
