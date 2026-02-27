// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-param-reassign */
import {
  EvaluationItem,
  JobItem,
  jobNameHelper,
  ModelItem,
  ProfileItem,
  SubmissionItem,
} from '@deepracer-indy/database';
import {
  CarCustomization,
  ObjectAvoidanceConfig,
  RaceType,
  ResettingBehaviorConfig,
  TrackDirection,
} from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, logger } from '@deepracer-indy/utils';

import { workflowHelper } from './WorkflowHelper.js';
import { trackHelper } from '../../utils/TrackHelper.js';
import {
  DEEPRACER_CAR_SHELL_ID,
  DEFAULT_DEEPRACER_CAR_SHELL_COLOR,
  SimAppCarShells,
  VALID_DEEPRACER_SHELL_COLORS,
} from '../constants/simulation.js';
import type { SimulationEnvironmentVariables } from '../types/simulationEnvironmentVariables.js';

class SimulationEnvironmentHelper {
  async getSimulationEnvironmentVariables(jobItem: JobItem, modelItem: ModelItem, profileItem: ProfileItem) {
    const { assetS3Locations: jobAssetS3Locations, name: jobName, trackConfig } = jobItem;
    const { carCustomization, name: modelName } = modelItem;

    const jobType = jobNameHelper.getJobType(jobName);
    const metricsS3Location = new AmazonS3URI(jobAssetS3Locations.metricsS3Location);
    const simTraceS3Location = new AmazonS3URI(jobAssetS3Locations.simTraceS3Location);

    const simEnvVars: Partial<SimulationEnvironmentVariables> = {
      AWS_REGION: process.env.REGION,
      ROBOMAKER_SIMULATION_JOB_ACCOUNT_ID: process.env.ACCOUNT_ID,
      JOB_TYPE: jobType.toUpperCase(),
      METRICS_S3_BUCKET: metricsS3Location.bucket,
      METRICS_S3_OBJECT_KEY: metricsS3Location.key,
      SIMTRACE_S3_BUCKET: simTraceS3Location.bucket,
      SIMTRACE_S3_PREFIX: simTraceS3Location.key,
      KINESIS_VIDEO_STREAM_NAME: jobName,
      MODEL_NAME: modelName,
      VIDEO_JOB_TYPE: workflowHelper.isSubmission(jobItem) ? 'RACING' : jobType.toUpperCase(),
      RACER_NAME: profileItem.alias,
      WORLD_NAME: trackConfig.trackId,
      TRACK_DIRECTION_CLOCKWISE: trackHelper.hasSingleEnabledDirection(trackConfig.trackId)
        ? undefined
        : trackConfig.trackDirection === TrackDirection.CLOCKWISE,
      RACE_TYPE: jobItem.raceType,

      // Leaderboard evaluation variables
      // LEADERBOARD_TYPE: '', // TODO: Figure out what this does and if we need it
      // LEADERBOARD_NAME: '', // TODO: Figure out what this does and if we need it
    };

    this.addCarCustomization(simEnvVars, carCustomization);

    if (workflowHelper.isEvaluation(jobItem) || workflowHelper.isSubmission(jobItem)) {
      this.addEvaluationAndSubmissionSpecificVariables(simEnvVars, jobItem, modelItem);
      this.addResettingBehavior(simEnvVars, jobItem.resettingBehaviorConfig);
    }
    if (workflowHelper.isTraining(jobItem)) {
      this.addTrainingSpecificVariables(simEnvVars, modelItem);
    }
    if (jobItem.raceType === RaceType.OBJECT_AVOIDANCE) {
      this.addObjectAvoidanceConfig(simEnvVars, jobItem.objectAvoidanceConfig as ObjectAvoidanceConfig);
    }

    logger.info('Generated SimApp environment variables', { simEnvVars });

    return simEnvVars;
  }

  private addEvaluationAndSubmissionSpecificVariables(
    simEnvVars: Partial<SimulationEnvironmentVariables>,
    jobItem: EvaluationItem | SubmissionItem,
    modelItem: ModelItem,
  ) {
    const { terminationConditions } = jobItem;
    const { assetS3Locations: modelAssetS3Locations } = modelItem;

    const sageMakerArtifactsS3Location = new AmazonS3URI(modelAssetS3Locations.sageMakerArtifactsS3Location);
    const videosS3Location = new AmazonS3URI(jobItem.assetS3Locations.videosS3Location);

    simEnvVars.MP4_S3_BUCKET = videosS3Location.bucket;
    simEnvVars.MP4_S3_OBJECT_PREFIX = videosS3Location.key;
    simEnvVars.MODEL_S3_BUCKET = sageMakerArtifactsS3Location.bucket;
    simEnvVars.MODEL_S3_PREFIX = sageMakerArtifactsS3Location.key;
    simEnvVars.NUMBER_OF_TRIALS = terminationConditions.maxLaps;
  }

  private addTrainingSpecificVariables(simEnvVars: Partial<SimulationEnvironmentVariables>, modelItem: ModelItem) {
    const { assetS3Locations: modelAssetS3Locations } = modelItem;

    const modelMetadataS3Location = new AmazonS3URI(modelAssetS3Locations.modelMetadataS3Location);
    const rewardFunctionS3Location = new AmazonS3URI(modelAssetS3Locations.rewardFunctionS3Location);
    const sageMakerArtifactsS3Location = new AmazonS3URI(modelAssetS3Locations.sageMakerArtifactsS3Location);

    simEnvVars.ALTERNATE_DRIVING_DIRECTION = false;
    simEnvVars.CHANGE_START_POSITION = true;
    simEnvVars.METRIC_NAME = 'TrainingRewardScore';
    simEnvVars.METRIC_NAMESPACE = 'DeepRacerIndy';
    simEnvVars.MODEL_METADATA_FILE_S3_KEY = modelMetadataS3Location.key;
    simEnvVars.REWARD_FILE_S3_KEY = rewardFunctionS3Location.key;
    simEnvVars.SAGEMAKER_SHARED_S3_BUCKET = sageMakerArtifactsS3Location.bucket;
    simEnvVars.SAGEMAKER_SHARED_S3_PREFIX = sageMakerArtifactsS3Location.key;
    // simEnvVars.NUMBER_OF_EPISODES = 1; // from trainingConfig.getTerminationConditions().getMaxEpisodes(); possibly add later
    // simEnvVars.TARGET_REWARD_SCORE = 1; // from trainingConfig.getTerminationConditions().getRewardScore(); possibly add later
    // simEnvVars.TRAINING_JOB_ARN = trainingJobArn; // DeepRacer training job arn. TODO: Verify it isn't required
  }

  private addCarCustomization(simEnvVars: Partial<SimulationEnvironmentVariables>, carCustomization: CarCustomization) {
    const { carColor, carShell } = carCustomization;

    simEnvVars.BODY_SHELL_TYPE = SimAppCarShells[carShell][carColor] ?? DEEPRACER_CAR_SHELL_ID;

    // CAR_COLOR var is only set for deepracer shell. Other shells use shell ID for shell + color.
    if (simEnvVars.BODY_SHELL_TYPE === DEEPRACER_CAR_SHELL_ID) {
      if (VALID_DEEPRACER_SHELL_COLORS.includes(carColor)) {
        // SimApp expects the deepracer shell color in sentence case
        simEnvVars.CAR_COLOR = carColor.slice(0, 1) + carColor.toLowerCase().slice(1);
      } else {
        logger.warn(`Invalid deepracer shell color: ${carColor}. Defaulting to ${DEFAULT_DEEPRACER_CAR_SHELL_COLOR}.`);
        simEnvVars.CAR_COLOR = DEFAULT_DEEPRACER_CAR_SHELL_COLOR;
      }
    }

    // simEnvVars.CAR_TOP_DECAL = '', // Present in SimApp, need research into available values
    // simEnvVars.CAR_SIDES_DECAL = '', // Present in SimApp, need research into available values
    // simEnvVars.CAR_BACK_DECAL = '', // Present in SimApp, need research into available values
  }

  private addResettingBehavior(
    simEnvVars: Partial<SimulationEnvironmentVariables>,
    resettingBehaviorConfig: ResettingBehaviorConfig,
  ) {
    simEnvVars.NUMBER_OF_RESETS = 10_000; // This value is expected by SimApp to allow resets
    simEnvVars.OFF_TRACK_PENALTY = resettingBehaviorConfig.offTrackPenaltySeconds;
    simEnvVars.COLLISION_PENALTY = resettingBehaviorConfig.collisionPenaltySeconds;
    simEnvVars.IS_CONTINUOUS = resettingBehaviorConfig.continuousLap;
  }

  private addObjectAvoidanceConfig(
    simEnvVars: Partial<SimulationEnvironmentVariables>,
    objectAvoidanceConfig: ObjectAvoidanceConfig,
  ) {
    const { numberOfObjects, objectPositions } = objectAvoidanceConfig;
    const hasDefinedObstaclePositions = !!objectPositions?.length;

    // SimApp accepts ["box_obstacle", "deepracer_box_obstacle", "amazon_box_obstacle"]
    // defaulting to box_obstacle for now
    simEnvVars.OBSTACLE_TYPE = 'box_obstacle';
    simEnvVars.IS_OBSTACLE_BOT_CAR = false;
    simEnvVars.NUMBER_OF_OBSTACLES = numberOfObjects;
    simEnvVars.RANDOMIZE_OBSTACLE_LOCATIONS = !hasDefinedObstaclePositions;

    if (hasDefinedObstaclePositions && objectPositions.length === numberOfObjects) {
      simEnvVars.OBJECT_POSITIONS = objectPositions.map(
        ({ laneNumber, trackPercentage }) => `${trackPercentage}, ${laneNumber}`,
      );
    }
  }
}

export const simulationEnvironmentHelper = new SimulationEnvironmentHelper();
