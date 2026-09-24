// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import { SageMakerClient as SageMakerClientClass } from '@aws-sdk/client-sagemaker';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import {
  JobItem,
  jobNameHelper,
  JobType,
  modelDao,
  ModelItem,
  profileDao,
  ProfileItem,
  RESOURCE_ID_REGEX,
} from '@deepracer-indy/database';
import {
  ContinuousActionSpace,
  DiscreteActionSpaceItem,
  JobStatus,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger, logMethod, s3Helper, tracer, waitForAll } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';
import * as YAML from 'yaml';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { CapacityMessage } from '../constants/capacityMessages.js';
import { ModelStatusForJobType } from '../constants/modelStatusForJobType.js';
import { RESOURCE_LIMIT_EXCEEDED_ERROR_NAME } from '../constants/sageMaker.js';
import {
  ActionSpaceType,
  DEEP_CONVOLUTIONAL_NETWORK_SHALLOW,
  SIM_APP_VERSION,
  TrainingAlgorithm,
} from '../constants/simulation.js';
import { CapacityStatus } from '../types/capacityCheckResult.js';
import type { ModelMetadataFile } from '../types/modelMetadataFile.js';
import type { WorkflowContext } from '../types/workflowContext.js';
import type { WorkflowTaskHandler } from '../types/workflowTaskHandler.js';
import { kinesisVideoStreamHelper } from '../utils/KinesisVideoStreamHelper.js';
import { sageMakerHelper, type AbacTaggedSageMakerClient } from '../utils/SageMakerHelper.js';
import { simulationEnvironmentHelper } from '../utils/SimulationEnvironmentHelper.js';
import { workflowHelper } from '../utils/WorkflowHelper.js';

const stsClient = tracer.captureAWSv3Client(
  new STSClient({
    region: process.env.AWS_REGION,
    logger,
    customUserAgent: getCustomUserAgent(),
  }),
);

class JobInitializer implements WorkflowTaskHandler {
  handler = async (workflowContext: WorkflowContext) => {
    try {
      await this.initializeJob(workflowContext);
    } catch (error) {
      // Only training jobs have a WAITING_FOR_CAPACITY status and a RetryTraining API. An evaluation
      // or submission also creates a SageMaker training job, so it can hit ResourceLimitExceeded too —
      // but routing it to WAITING_FOR_CAPACITY would strand it in a status nothing can recover from.
      const isTrainingJob = jobNameHelper.getJobType(workflowContext.jobName) === JobType.TRAINING;

      if (isTrainingJob && this.isCapacityError(error)) {
        // A race between the API's capacity check and SageMaker's admission decision. This is not a
        // job failure: the job returns to WAITING_FOR_CAPACITY and the user retries when they choose.
        logger.warn('SageMaker rejected the training job for lack of capacity', { error });
        workflowContext.capacityWaiting = true;
        workflowContext.statusMessage = CapacityMessage.UNAVAILABLE;
      } else {
        workflowContext.errorDetails = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
    } finally {
      await this.persistWorkflowData(workflowContext);
    }

    logger.info('END JobInitializer task', { workflowContext });
    return workflowContext;
  };

  /**
   * True when CreateTrainingJob was rejected specifically because a SageMaker quota is exhausted.
   * Matched on the exact SDK error name so an unrelated failure is never treated as capacity waiting.
   */
  private isCapacityError(error: unknown) {
    return (error as { name?: string } | undefined)?.name === RESOURCE_LIMIT_EXCEEDED_ERROR_NAME;
  }

  /**
   * Assume the job-creation role with a profile-id session tag and return a SageMaker client
   * backed by the tagged credentials. SageMaker chains the tag onto the execution role's session
   * (SessionChainingConfig), so the ABAC S3 policy scopes access to this profile only.
   * Throws if the role ARN is not configured.
   */
  private async createTaggedSageMakerClient(profileId: string): Promise<AbacTaggedSageMakerClient> {
    const jobCreationRoleArn = process.env.SAGEMAKER_JOB_CREATION_ROLE_ARN;
    if (!jobCreationRoleArn) {
      throw new Error('SAGEMAKER_JOB_CREATION_ROLE_ARN is not set — ABAC session-tag chaining is required');
    }
    if (!RESOURCE_ID_REGEX.test(profileId)) {
      throw new Error(`profileId is not a valid ResourceId: ${profileId}`);
    }

    const { Credentials } = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: jobCreationRoleArn,
        RoleSessionName: `training-${profileId}`,
        Tags: [{ Key: 'profile-id', Value: profileId }],
      }),
    );

    if (!Credentials?.AccessKeyId || !Credentials?.SecretAccessKey || !Credentials?.SessionToken) {
      throw new Error('STS AssumeRole for ABAC returned no credentials');
    }

    return tracer.captureAWSv3Client(
      new SageMakerClientClass({
        logger,
        customUserAgent: getCustomUserAgent(),
        retryMode: 'adaptive',
        maxAttempts: 10,
        credentials: {
          accessKeyId: Credentials.AccessKeyId,
          secretAccessKey: Credentials.SecretAccessKey,
          sessionToken: Credentials.SessionToken,
        },
      }),
    ) as AbacTaggedSageMakerClient; // NOSONAR — branded type; captureAWSv3Client returns SageMakerClient, not the branded subtype
  }

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

    // Use context jobName if provided (live races use a unique suffix), otherwise fall back to DDB name
    jobItem.name = workflowContext.jobName ?? jobItem.name;

    // Capacity can change between the API's check and this execution, so recheck immediately before
    // creating the SageMaker job. An UNKNOWN result fails closed: the job waits rather than risking a
    // rejected CreateTrainingJob.
    if (workflowHelper.isTraining(jobItem)) {
      const capacity = await sageMakerHelper.checkTrainingCapacity();

      if (capacity.status !== CapacityStatus.AVAILABLE) {
        logger.warn('Training capacity not confirmed before CreateTrainingJob; job will wait for capacity', {
          jobName,
          capacityStatus: capacity.status,
          reason: capacity.status === CapacityStatus.UNAVAILABLE ? capacity.reason : undefined,
        });

        workflowContext.capacityWaiting = true;
        workflowContext.statusMessage =
          capacity.status === CapacityStatus.UNAVAILABLE ? CapacityMessage.UNAVAILABLE : CapacityMessage.UNKNOWN;

        return workflowContext;
      }
    }

    const trainingJobArn = await sageMakerHelper.createTrainingJob({
      jobItem,
      modelItem,
      client: await this.createTaggedSageMakerClient(profileId),
    });

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
    const { capacityWaiting, errorDetails, jobName, modelId, profileId, leaderboardId, statusMessage, trainingJob } =
      workflowContext;

    const jobType = jobNameHelper.getJobType(jobName);

    let jobStatus: JobStatus = JobStatus.INITIALIZING;
    let modelStatus: ModelStatus = ModelStatusForJobType[jobType];

    if (capacityWaiting && jobType === JobType.TRAINING) {
      // A capacity failure must never become ERROR/FAILED: the model is still valid and retryable.
      jobStatus = JobStatus.WAITING_FOR_CAPACITY;
      modelStatus = ModelStatus.WAITING_FOR_CAPACITY;
    } else if (errorDetails) {
      jobStatus = JobStatus.FAILED;
      modelStatus = jobType === JobType.TRAINING ? ModelStatus.ERROR : ModelStatus.READY;
    }

    try {
      await waitForAll([
        modelDao.update({ modelId, profileId }, { status: modelStatus, statusMessage }),
        workflowHelper.updateJob(
          { jobName, modelId, profileId, leaderboardId },
          {
            sageMakerJobArn: trainingJob?.arn,
            status: jobStatus,
            statusMessage,
            startTime: new Date().toISOString(),
          },
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
