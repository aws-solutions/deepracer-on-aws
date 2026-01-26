// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { basename } from 'node:path';

import {
  CreateTrainingJobCommandInput,
  TrainingInputMode,
  CreateTrainingJobCommand,
  DescribeTrainingJobCommand,
  StopTrainingJobCommand,
  TrainingJobStatus,
  paginateListTrainingJobs,
} from '@aws-sdk/client-sagemaker';
import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { JobItem, JobName, ModelItem, jobNameHelper, modelDao } from '@deepracer-indy/database';
import { InternalFailureError, TrackDirection } from '@deepracer-indy/typescript-server-client';
import { logMethod, AmazonS3URI, logger, waitForAll } from '@deepracer-indy/utils';

import { serviceQuotasHelper } from './ServiceQuotasHelper';
import { sageMakerClient } from '../../utils/clients/sageMakerClient.js';
import { TrainingInstanceQuotaCode } from '../constants/sageMaker.js';
import { SimulationLaunchFile } from '../constants/simulation.js';
import type { SageMakerHyperparameters } from '../types/sageMakerHyperparameters.js';

class SageMakerHelper {
  @logMethod
  async createTrainingJob({ jobItem, modelItem }: { jobItem: JobItem; modelItem: ModelItem }) {
    // TODO: metrics handling
    // eslint-disable-next-line no-useless-catch
    try {
      const { name: jobName, terminationConditions } = jobItem;

      if (!process.env.SAGEMAKER_TRAINING_IMAGE) {
        throw new Error('SAGEMAKER_TRAINING_IMAGE environment variable is not set');
      }

      const createTrainingJobInput: CreateTrainingJobCommandInput = {
        TrainingJobName: jobName,
        RoleArn: process.env.SAGEMAKER_ROLE_ARN,
        AlgorithmSpecification: {
          TrainingInputMode: TrainingInputMode.FILE,
          TrainingImage: process.env.SAGEMAKER_TRAINING_IMAGE,
        },
        OutputDataConfig: {
          S3OutputPath: modelItem.assetS3Locations.sageMakerArtifactsS3Location,
        },
        ResourceConfig: {
          InstanceCount: deepRacerIndyAppConfig.sageMaker.instanceCount,
          InstanceType: deepRacerIndyAppConfig.sageMaker.instanceType,
          VolumeSizeInGB: deepRacerIndyAppConfig.sageMaker.instanceVolumeSizeInGB,
        },
        StoppingCondition: {
          MaxRuntimeInSeconds: terminationConditions.maxTimeInMinutes * 60,
        },
        HyperParameters: await this.getSageMakerHyperparameters(jobItem, modelItem),
      };

      const { TrainingJobArn } = await sageMakerClient.send(new CreateTrainingJobCommand(createTrainingJobInput));

      return TrainingJobArn as string;
    } catch (error) {
      throw error;
    }
  }

  @logMethod
  async getTrainingJob(jobName: JobName) {
    // useless-catch will be addressed after adding metrics
    // eslint-disable-next-line no-useless-catch
    try {
      const describeTrainingJobResponse = await sageMakerClient.send(
        new DescribeTrainingJobCommand({ TrainingJobName: jobName }),
      );
      return describeTrainingJobResponse;
    } catch (error) {
      // TODO: metrics handling
      throw error;
    }
  }

  @logMethod
  async stopTrainingJob(jobName: JobName) {
    // useless-catch will be addressed after adding metrics
    // eslint-disable-next-line no-useless-catch
    try {
      // Attempting to stop a sageMaker job in a terminal status will result in an error,
      // so we check this is not the case before doing so.
      const { TrainingJobStatus: trainingJobStatus } = await this.getTrainingJob(jobName);

      if (trainingJobStatus === TrainingJobStatus.IN_PROGRESS) {
        await sageMakerClient.send(new StopTrainingJobCommand({ TrainingJobName: jobName }));
      } else {
        logger.warn(`SageMaker training job already in terminal state: ${trainingJobStatus}`);
      }
    } catch (error) {
      // TODO: metrics handling
      throw error;
    }
  }

  /**
   * Stops a queued SageMaker training job by waiting for it to start, then stopping it.
   * This method polls the job status until it's no longer in PENDING state or timeout is reached.
   * @param jobName - The name of the SageMaker training job
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 60000ms = 60 seconds)
   * @param pollIntervalMs - Time between status checks in milliseconds (default: 2000ms = 2 seconds)
   */
  @logMethod
  async stopQueuedJob(jobName: JobName, timeoutMs = 60000, pollIntervalMs = 2000) {
    const startTime = Date.now();
    logger.debug('Starting stopQueuedJob', { jobName, timeoutMs, pollIntervalMs });

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      while (Date.now() - startTime < timeoutMs) {
        try {
          const { TrainingJobStatus: trainingJobStatus } = await this.getTrainingJob(jobName);
          logger.debug('Queued job status check', { jobName, trainingJobStatus });

          // If job has started, stop it
          if (trainingJobStatus === TrainingJobStatus.IN_PROGRESS) {
            logger.debug('Job started, sending stop command', { jobName });
            await sageMakerClient.send(new StopTrainingJobCommand({ TrainingJobName: jobName }));
            logger.debug('Stop command sent successfully', { jobName });
            return;
          }

          // If job is already in a terminal state, no need to stop
          if (
            trainingJobStatus === TrainingJobStatus.COMPLETED ||
            trainingJobStatus === TrainingJobStatus.STOPPED ||
            trainingJobStatus === TrainingJobStatus.FAILED
          ) {
            logger.debug('Job already in terminal state, no stop needed', { jobName, trainingJobStatus });
            return;
          }

          // Job is still pending, wait and retry
          logger.debug('Job still pending, waiting before retry', { jobName, trainingJobStatus });
          await delay(pollIntervalMs);
        } catch (error) {
          // If job doesn't exist yet, wait and retry
          logger.debug('Error checking job status, will retry', { jobName, error });
          await delay(pollIntervalMs);
        }
      }

      // Timeout reached - job is still not stopped
      logger.warn('Timeout reached while waiting for queued job to start', { jobName, timeoutMs });
      throw new InternalFailureError({ message: 'Failed to cancel job. Please check with your administrator' });
    } catch (error) {
      logger.error('Error in stopQueuedJob', { jobName, error });
      throw error;
    }
  }

  async getSageMakerHyperparameters(jobItem: JobItem, modelItem: ModelItem) {
    const { assetS3Locations: jobAssetS3Locations, name: jobName, trackConfig } = jobItem;
    const { assetS3Locations: modelAssetS3Locations, clonedFromModelId, modelId, profileId } = modelItem;

    const preTrainedModelHyperparameters: Pick<
      SageMakerHyperparameters,
      'pretrained_s3_bucket' | 'pretrained_s3_prefix'
    > = {};

    if (clonedFromModelId) {
      const preTrainedModel = await modelDao.get({ profileId, modelId: clonedFromModelId });

      // Handle preTrainedModel having been deleted
      if (!preTrainedModel) {
        const errorMsg = 'Pre-trained source model for clone does not exist.';
        logger.error(errorMsg, { newModelId: modelId, preTrainedModelId: clonedFromModelId });
        throw new Error(errorMsg);
      }

      const preTrainedModelSageMakerArtifactsS3Location = new AmazonS3URI(
        preTrainedModel.assetS3Locations.sageMakerArtifactsS3Location,
      );

      preTrainedModelHyperparameters.pretrained_s3_bucket = preTrainedModelSageMakerArtifactsS3Location.bucket;
      preTrainedModelHyperparameters.pretrained_s3_prefix = preTrainedModelSageMakerArtifactsS3Location.key;
    }

    const sageMakerArtifactsS3Location = new AmazonS3URI(modelAssetS3Locations.sageMakerArtifactsS3Location);

    const modelHyperparameters = Object.entries(modelItem.metadata.hyperparameters).reduce(
      (acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      },
      {} as Record<string, string>,
    );

    const sageMakerHyperparameters = {
      ...modelHyperparameters,
      ...preTrainedModelHyperparameters,
      aws_region: process.env.REGION as string,
      heartbeat_s3_location: jobAssetS3Locations.simulationHeartbeatS3Location,
      kinesis_stream_name: jobName,
      model_metadata_s3_key: modelAssetS3Locations.modelMetadataS3Location,
      reward_function_s3_source: modelAssetS3Locations.rewardFunctionS3Location,
      s3_bucket: sageMakerArtifactsS3Location.bucket,
      s3_prefix: sageMakerArtifactsS3Location.key,
      s3_ros_log_bucket: process.env.MODEL_DATA_BUCKET_NAME as string,
      s3_yaml_name: basename(jobAssetS3Locations.simulationYamlS3Location),
      simulation_launch_file: SimulationLaunchFile[jobNameHelper.getJobType(jobName)],
      track_direction_clockwise: String(trackConfig.trackDirection === TrackDirection.CLOCKWISE),
      world_name: trackConfig.trackId,
    } satisfies SageMakerHyperparameters;

    return sageMakerHyperparameters;
  }

  async getTrainingInstanceQuota() {
    const instanceQuota = await serviceQuotasHelper.getServiceQuota(
      'sagemaker',
      TrainingInstanceQuotaCode[deepRacerIndyAppConfig.sageMaker.instanceType],
    );

    logger.info(
      `SageMaker ${deepRacerIndyAppConfig.sageMaker.instanceType} training instance quota is set to ${instanceQuota.Value}`,
    );

    return instanceQuota.Value as number;
  }

  async getTrainingInstanceUsage() {
    const TWENTY_FOUR_HOURS_10_MINS_IN_MILLIS = 24 * 60 * 60 * 1000 + 10 * 60 * 1000; // Longest job duration + 10 min buffer

    let instanceUsage = 0;

    try {
      for await (const result of paginateListTrainingJobs(
        { client: sageMakerClient },
        {
          CreationTimeAfter: new Date(Date.now() - TWENTY_FOUR_HOURS_10_MINS_IN_MILLIS),
          NameContains: 'deepracerindy',
          StatusEquals: TrainingJobStatus.IN_PROGRESS,
        },
      )) {
        instanceUsage += result.TrainingJobSummaries?.length ?? 0;
      }
      for await (const result of paginateListTrainingJobs(
        { client: sageMakerClient },
        {
          CreationTimeAfter: new Date(Date.now() - TWENTY_FOUR_HOURS_10_MINS_IN_MILLIS),
          NameContains: 'deepracerindy',
          StatusEquals: TrainingJobStatus.STOPPING,
        },
      )) {
        instanceUsage += result.TrainingJobSummaries?.length ?? 0;
      }

      return instanceUsage;
    } catch (error) {
      logger.error('Error fetching SageMaker instance usage', { error });
      throw error;
    }
  }

  async isTrainingInstanceCapacityAvailable() {
    const [instanceQuota, instanceUsage] = await waitForAll([
      this.getTrainingInstanceQuota(),
      this.getTrainingInstanceUsage(),
    ]);

    const isCapacityAvailable = instanceQuota > instanceUsage;

    if (isCapacityAvailable) {
      logger.info(`Active SageMaker training instances [${instanceUsage}] is less than quota [${instanceQuota}]`);
    } else {
      logger.warn(
        `Active SageMaker training instances [${instanceUsage}] is equal to or greater than quota [${instanceQuota}]`,
      );
    }

    return isCapacityAvailable;
  }
}

export const sageMakerHelper = new SageMakerHelper();
