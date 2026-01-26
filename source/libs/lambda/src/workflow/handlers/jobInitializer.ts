// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import {
  JobItem,
  jobNameHelper,
  JobType,
  modelDao,
  ModelItem,
  profileDao,
  ProfileItem,
} from '@deepracer-indy/database';
import {
  ContinuousActionSpace,
  DiscreteActionSpaceItem,
  JobStatus,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger, logMethod, s3Helper, waitForAll } from '@deepracer-indy/utils';
import * as YAML from 'yaml';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { ModelStatusForJobType } from '../constants/modelStatusForJobType.js';
import {
  ActionSpaceType,
  DEEP_CONVOLUTIONAL_NETWORK_SHALLOW,
  SIM_APP_VERSION,
  TrainingAlgorithm,
} from '../constants/simulation.js';
import type { ModelMetadataFile } from '../types/modelMetadataFile.js';
import type { WorkflowContext } from '../types/workflowContext.js';
import type { WorkflowTaskHandler } from '../types/workflowTaskHandler.js';
import { kinesisVideoStreamHelper } from '../utils/KinesisVideoStreamHelper.js';
import { sageMakerHelper } from '../utils/SageMakerHelper.js';
import { simulationEnvironmentHelper } from '../utils/SimulationEnvironmentHelper.js';
import { workflowHelper } from '../utils/WorkflowHelper.js';

class JobInitializer implements WorkflowTaskHandler {
  handler = async (workflowContext: WorkflowContext) => {
    try {
      await this.initializeJob(workflowContext);
    } catch (error) {
      workflowContext.errorDetails = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } finally {
      await this.persistWorkflowData(workflowContext);
    }

    logger.info('END JobInitializer task', { workflowContext });
    return workflowContext;
  };

  @logMethod
  async initializeJob(workflowContext: WorkflowContext) {
    const { jobName, modelId, profileId, leaderboardId } = workflowContext;

    const [jobItem, modelItem, profileItem] = await waitForAll([
      workflowHelper.getJob({ jobName, modelId, profileId, leaderboardId }),
      modelDao.load({ modelId, profileId }),
      profileDao.load({ profileId }),
    ]);

    const videoStreamArn = await kinesisVideoStreamHelper.createStream(jobName);

    workflowContext.videoStream = {
      arn: videoStreamArn,
      name: jobName,
    };

    await this.writeJobFilesToS3(jobItem, modelItem, profileItem);

    if (workflowHelper.isEvaluation(jobItem) || workflowHelper.isSubmission(jobItem)) {
      await this.deleteOldSimulationHeartbeatFile(jobItem.assetS3Locations.simulationHeartbeatS3Location);
    }

    const trainingJobArn = await sageMakerHelper.createTrainingJob({ jobItem, modelItem });

    workflowContext.simulationJob = {
      heartbeatS3Location: jobItem.assetS3Locations.simulationHeartbeatS3Location,
    };

    workflowContext.trainingJob = {
      arn: trainingJobArn,
      name: jobName,
    };

    return workflowContext;
  }

  private async deleteOldSimulationHeartbeatFile(simulationHeartbeatS3Location: string) {
    try {
      await s3Helper.deleteS3Location(simulationHeartbeatS3Location);
    } catch (error) {
      logger.warn('Unable to delete previous simulation heartbeat file', { error, simulationHeartbeatS3Location });
    }
  }

  writeJobFilesToS3(jobItem: JobItem, modelItem: ModelItem, profileItem: ProfileItem) {
    const writeJobFilePromises = [this.writeSimulationYAMLToS3(jobItem, modelItem, profileItem)];

    if (workflowHelper.isTraining(jobItem)) {
      writeJobFilePromises.push(this.writeModelMetadataToS3(modelItem), this.writeRewardFunctionToS3(modelItem));
    }

    return waitForAll(writeJobFilePromises);
  }

  writeModelMetadataToS3(modelItem: ModelItem) {
    const { assetS3Locations: modelAssetS3Locations, metadata } = modelItem;

    const actionSpaceType = metadata.actionSpace.continous ? ActionSpaceType.CONTINUOUS : ActionSpaceType.DISCRETE;

    let actionSpaceMetadata: ContinuousActionSpace | DiscreteActionSpaceItem[];
    let actionSpace: ModelMetadataFile['action_space'];

    if (actionSpaceType === ActionSpaceType.CONTINUOUS) {
      actionSpaceMetadata = metadata.actionSpace.continous as ContinuousActionSpace;
      actionSpace = {
        speed: {
          high: actionSpaceMetadata.highSpeed,
          low: actionSpaceMetadata.lowSpeed,
        },
        steering_angle: {
          high: actionSpaceMetadata.highSteeringAngle,
          low: actionSpaceMetadata.lowSteeringAngle,
        },
      };
    } else {
      actionSpaceMetadata = metadata.actionSpace.discrete as DiscreteActionSpaceItem[];
      actionSpace = actionSpaceMetadata.map(({ speed, steeringAngle }) => ({
        speed,
        steering_angle: steeringAngle,
      }));
    }

    const modelMetadataFileContents: ModelMetadataFile = {
      action_space: actionSpace,
      action_space_type: actionSpaceType,
      neural_network: DEEP_CONVOLUTIONAL_NETWORK_SHALLOW,
      sensor: Object.values(metadata.sensors),
      training_algorithm: TrainingAlgorithm[metadata.agentAlgorithm],
      version: SIM_APP_VERSION,
    };

    logger.info('Generated model metadata file contents', { modelMetadataFileContents });

    return s3Helper.writeToS3(
      JSON.stringify(modelMetadataFileContents, null, 2),
      modelAssetS3Locations.modelMetadataS3Location,
    );
  }

  writeRewardFunctionToS3(modelItem: ModelItem) {
    const {
      assetS3Locations: modelAssetS3Locations,
      metadata: { rewardFunction },
    } = modelItem;

    return s3Helper.writeToS3(rewardFunction, modelAssetS3Locations.rewardFunctionS3Location);
  }

  async writeSimulationYAMLToS3(jobItem: JobItem, modelItem: ModelItem, profileItem: ProfileItem) {
    const { assetS3Locations: jobAssetS3Locations } = jobItem;

    const simEnvVars = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
      jobItem,
      modelItem,
      profileItem,
    );

    return s3Helper.writeToS3(YAML.stringify(simEnvVars), jobAssetS3Locations.simulationYamlS3Location);
  }

  async persistWorkflowData(workflowContext: WorkflowContext) {
    const { errorDetails, jobName, modelId, profileId, leaderboardId, trainingJob } = workflowContext;

    const jobType = jobNameHelper.getJobType(jobName);

    let jobStatus: JobStatus = JobStatus.INITIALIZING;
    let modelStatus: ModelStatus = ModelStatusForJobType[jobType];

    if (errorDetails) {
      jobStatus = JobStatus.FAILED;
      modelStatus = jobType === JobType.TRAINING ? ModelStatus.ERROR : ModelStatus.READY;
    }

    try {
      await waitForAll([
        modelDao.update({ modelId, profileId }, { status: modelStatus }),
        workflowHelper.updateJob(
          { jobName, modelId, profileId, leaderboardId },
          { sageMakerJobArn: trainingJob?.arn, status: jobStatus, startTime: new Date().toISOString() },
        ),
      ]);
    } catch (error) {
      logger.error('Unable to update model or job in DynamoDB', { error });
      workflowContext.errorDetails = error as Error;
    }
  }
}

export const jobInitializer = new JobInitializer();
export const lambdaHandler = instrumentHandler(jobInitializer.handler);
