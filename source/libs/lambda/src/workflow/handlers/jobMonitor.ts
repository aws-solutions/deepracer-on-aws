// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import { JobStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { SimulationJobStatus } from '../constants/simulation.js';
import type { SimulationHeartbeatFile } from '../types/simulationHeartbeatFile.js';
import type { WorkflowContext } from '../types/workflowContext.js';
import type { WorkflowTaskHandler } from '../types/workflowTaskHandler.js';
import { kinesisVideoStreamHelper } from '../utils/KinesisVideoStreamHelper.js';
import { sageMakerHelper } from '../utils/SageMakerHelper.js';
import { workflowHelper } from '../utils/WorkflowHelper.js';

class JobMonitor implements WorkflowTaskHandler {
  handler = async (workflowContext: WorkflowContext) => {
    logger.info('START JobMonitor task', { workflowContext });

    // Store deep copy of workflow context for detecting changes to avoid unnecessary updates
    const previousWorkflowContext = JSON.parse(JSON.stringify(workflowContext)) as WorkflowContext;

    try {
      await this.monitorJob(workflowContext);
    } catch (error) {
      workflowContext.errorDetails = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } finally {
      await this.persistWorkflowData(previousWorkflowContext, workflowContext);
    }

    logger.info('END JobMonitor task', { workflowContext });
    return workflowContext;
  };

  async monitorJob(workflowContext: WorkflowContext) {
    await this.checkSimulationJobStatus(workflowContext);
    await this.checkSageMakerTrainingJobStatus(workflowContext);
    await this.checkVideoStreamUrl(workflowContext);
  }

  async checkVideoStreamUrl(workflowContext: WorkflowContext) {
    const { trainingJob, videoStream } = workflowContext;

    if (trainingJob?.status !== TrainingJobStatus.IN_PROGRESS || !videoStream) {
      logger.info('Training job not in progress or no video stream, skipping video stream URL check');
      return;
    }

    if (!videoStream.urlExpiration || new Date() > new Date(videoStream.urlExpiration)) {
      logger.info('Video stream URL does not exist or is expired, refreshing');

      const videoStreamUrl = await kinesisVideoStreamHelper.getHlsStreamingSessionUrl(videoStream.name);

      if (videoStreamUrl) {
        videoStream.url = videoStreamUrl;
        videoStream.urlExpiration = new Date(
          Date.now() + 1000 * kinesisVideoStreamHelper.KINESIS_STREAMING_URL_MAX_EXPIRATION,
        ).toISOString();
      }
    }
  }

  async checkSimulationJobStatus(workflowContext: WorkflowContext) {
    const { simulationJob, trainingJob } = workflowContext;

    if (!simulationJob || !trainingJob) {
      throw new Error('Missing simulation job or training job details.');
    }

    let simulationHeartbeatFileJson: string;
    try {
      simulationHeartbeatFileJson = await s3Helper.getObjectAsStringFromS3(simulationJob.heartbeatS3Location, false);
    } catch (error) {
      logger.error('Error fetching simulation heartbeat file.', {
        heartbeatS3Location: simulationJob.heartbeatS3Location,
        error,
      });
      throw error;
    }

    if (!simulationHeartbeatFileJson) {
      logger.warn('Simulation heartbeat file does not exist yet.');
      return;
    }

    const simulationHeartbeatFile: SimulationHeartbeatFile = JSON.parse(simulationHeartbeatFileJson);

    if (simulationHeartbeatFile.jobStatus === SimulationJobStatus.FAILED) {
      await sageMakerHelper.stopTrainingJob(trainingJob.name);
      trainingJob.status = TrainingJobStatus.STOPPED;
      throw new Error(`Simulation job failed: ${simulationHeartbeatFile.message}`);
    }
  }

  async checkSageMakerTrainingJobStatus(workflowContext: WorkflowContext) {
    const { trainingJob } = workflowContext;

    if (!trainingJob) {
      throw new Error('No training job details found.');
    }

    const { TrainingJobStatus: trainingJobStatus } = await sageMakerHelper.getTrainingJob(trainingJob.name);

    trainingJob.status = trainingJobStatus;
  }

  async persistWorkflowData(previousWorkflowContext: WorkflowContext, workflowContext: WorkflowContext) {
    const { videoStream: previousVideoStream } = previousWorkflowContext;
    const { jobName, leaderboardId, modelId, profileId, videoStream } = workflowContext;

    try {
      // Once SimApp is producing a video stream, updates job status to IN_PROGRESS
      // This also updates the video stream URL if it is refreshed
      if (videoStream?.url !== previousVideoStream?.url) {
        await workflowHelper.updateJob(
          { jobName, leaderboardId, modelId, profileId },
          { videoStreamUrl: videoStream?.url, status: JobStatus.IN_PROGRESS },
        );
      }
    } catch (error) {
      logger.error('Unable to update job in DynamoDB', { error });
      workflowContext.errorDetails = error as Error;
    }
  }
}

export const jobMonitor = new JobMonitor();
export const lambdaHandler = instrumentHandler(jobMonitor.handler);
