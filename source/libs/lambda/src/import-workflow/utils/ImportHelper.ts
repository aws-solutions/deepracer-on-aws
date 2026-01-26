// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AgentAlgorithm,
  CameraSensor,
  CarColor,
  CarCustomization,
  CarShell,
  Hyperparameters,
  LidarSensor,
  ObjectAvoidanceConfig,
  ObjectPosition,
  RaceType,
  Sensors,
  TrackConfig,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, logger, s3Helper, waitForAll } from '@deepracer-indy/utils';
import * as YAML from 'yaml';

import { TRACKS } from '../../api/constants/tracks.js';
import { CLOCKWISE_TRACK_SUFFIX, COUNTER_CLOCKWISE_TRACK_SUFFIX } from '../../api/utils/RewardFunctionValidator.js';
import { trackHelper } from '../../utils/TrackHelper.js';
import { DEEPRACER_CAR_SHELL_ID, SimAppCarShells, TrainingAlgorithm } from '../../workflow/constants/simulation.js';
import type { EvaluationMetricsFile } from '../../workflow/types/evaluationMetricsFile.js';
import type { ModelMetadataFile } from '../../workflow/types/modelMetadataFile.js';
import type { SimulationEnvironmentVariables } from '../../workflow/types/simulationEnvironmentVariables.js';

class ImportHelper {
  /**
   * Parses model metadata JSON file from S3
   * @param s3Location S3 URI where model files are stored
   * @returns Parsed model metadata
   */
  async parseModelMetadata(s3Location: string): Promise<ModelMetadataFile> {
    const modelMetadataPath = `${s3Location}/model_metadata.json`;
    const modelMetadataString = await s3Helper.getObjectAsStringFromS3(modelMetadataPath);
    if (!modelMetadataString) {
      throw new Error(`Model metadata not found at ${modelMetadataPath}`);
    }
    const modelMetadata = JSON.parse(modelMetadataString) as ModelMetadataFile;
    logger.info('Retrieved model metadata', { modelMetadata });
    return modelMetadata;
  }

  /**
   * Retrieves reward function Python file from S3
   * @param s3Location S3 URI where model files are stored
   * @returns Reward function as string
   */
  async parseRewardFunction(s3Location: string): Promise<string> {
    const rewardFunctionPath = `${s3Location}/reward_function.py`;
    const rewardFunction = await s3Helper.getObjectAsStringFromS3(rewardFunctionPath);
    if (!rewardFunction) {
      throw new Error(`Reward function not found at ${rewardFunctionPath}`);
    }
    logger.info('Retrieved reward function', { rewardFunction });
    return rewardFunction;
  }

  /**
   * Parses hyperparameters JSON file from S3
   * @param s3Location S3 URI where model files are stored
   * @returns Parsed hyperparameters
   */
  async parseHyperparameters(s3Location: string): Promise<Hyperparameters> {
    const hyperparametersPath = `${s3Location}/ip/hyperparameters.json`;
    const hyperparametersString = await s3Helper.getObjectAsStringFromS3(hyperparametersPath);
    if (!hyperparametersString) {
      throw new Error(`Hyperparameters not found at ${hyperparametersPath}`);
    }
    const hyperparameters = JSON.parse(hyperparametersString) as Hyperparameters;
    logger.info('Retrieved hyperparameters', { hyperparameters });
    return hyperparameters;
  }

  /**
   * Finds and parses metrics JSON file from S3
   * @param s3Location S3 URI where model files are stored
   * @returns Parsed metrics or null if not found
   */
  async parseMetrics(s3Location: string): Promise<EvaluationMetricsFile | undefined> {
    const sourceS3Uri = new AmazonS3URI(s3Location);
    const metricsPrefix = `${sourceS3Uri.key}/metrics/training/`;

    const listResponse = await s3Helper.listObjects(sourceS3Uri.bucket, metricsPrefix);
    const trainingFile = listResponse.Contents?.find(
      (obj) => obj.Key?.includes('training-') && obj.Key?.endsWith('.json'),
    );

    if (!trainingFile?.Key) {
      logger.warn('No training metrics file found with pattern training-*.json');
      return;
    }

    const trainingFileS3Location = `s3://${sourceS3Uri.bucket}/${trainingFile.Key}`;
    const metricsString = await s3Helper.getObjectAsStringFromS3(trainingFileS3Location);
    if (!metricsString) {
      throw new Error(`Metrics not found at ${trainingFileS3Location}`);
    }
    const metrics = JSON.parse(metricsString) as EvaluationMetricsFile;

    logger.info('Retrieved metrics', { metrics });
    return metrics;
  }

  /**
   * Copies metrics file from source S3 location to destination
   * @param s3Location Source S3 location containing the metrics file
   * @param destinationS3Location Destination S3 location for the metrics file
   */
  async copyMetricsFile(s3Location: string, destinationS3Location: string): Promise<void> {
    const sourceS3Uri = new AmazonS3URI(s3Location);
    const destS3Uri = new AmazonS3URI(destinationS3Location);
    const metricsPrefix = `${sourceS3Uri.key}/metrics/training/`;

    const listResponse = await s3Helper.listObjects(sourceS3Uri.bucket, metricsPrefix);
    const trainingFile = listResponse.Contents?.find(
      (obj) => obj.Key?.includes('training-') && obj.Key?.endsWith('.json'),
    );

    if (!trainingFile?.Key) {
      logger.warn('No training metrics file found to copy');
      return;
    }

    await s3Helper.copyObject(sourceS3Uri.bucket, trainingFile.Key, destS3Uri.bucket, destS3Uri.key);
    logger.info('Successfully copied metrics file', { sourceKey: trainingFile.Key, destinationKey: destS3Uri.key });
  }

  /**
   * Parses training parameters YAML file from S3
   * @param s3Location S3 URI where model files are stored
   * @returns Parsed training parameters
   */
  async parseTrainingParams(s3Location: string): Promise<SimulationEnvironmentVariables> {
    const yamlPath = `${s3Location}/training_params.yaml`;
    const yamlString = await s3Helper.getObjectAsStringFromS3(yamlPath);
    if (!yamlString) {
      throw new Error(`Training params not found at ${yamlPath}`);
    }
    const trainingParams = YAML.parse(yamlString);
    logger.info('Parsed training params from YAML', { trainingParams });
    return trainingParams;
  }

  /**
   * Retrieves and parses all model files from S3 location
   * @param s3Location S3 URI where model files are stored
   * @returns Object containing parsed training parameters, model metadata, reward function, and hyperparameters
   */
  async parseImportedFiles(s3Location: string): Promise<{
    trainingParams: SimulationEnvironmentVariables;
    modelMetadata: ModelMetadataFile;
    rewardFunction: string;
    hyperparameters: Hyperparameters;
  }> {
    const [trainingParams, modelMetadata, rewardFunction, hyperparameters] = await waitForAll([
      this.parseTrainingParams(s3Location),
      this.parseModelMetadata(s3Location),
      this.parseRewardFunction(s3Location),
      this.parseHyperparameters(s3Location),
    ]);

    return { trainingParams, modelMetadata, rewardFunction, hyperparameters };
  }

  /**
   * Copies model files from source S3 location to destination bucket
   * @param sourceS3Location Source S3 location containing the model files
   * @param profileId Profile ID for the destination path
   * @param modelId Model ID for the destination path
   */
  async copyModelFiles(sourceS3Location: string, profileId: string, modelId: string): Promise<void> {
    const sourceS3Uri = new AmazonS3URI(sourceS3Location);
    const sourceBucket = sourceS3Uri.bucket;
    const sourcePrefix = sourceS3Uri.key;
    const localDestBucket = process.env.MODEL_DATA_BUCKET_NAME;
    if (!localDestBucket) {
      throw new Error('MODEL_DATA_BUCKET_NAME environment variable is not defined');
    }
    const destinationPrefix = `${profileId}/models/${modelId}/`;
    logger.info('Copying model files', {
      sourceBucket,
      sourcePrefix,
      localDestBucket,
      destinationPrefix,
    });

    let copied = 0;

    try {
      const listResponse = await s3Helper.listObjects(sourceBucket, sourcePrefix);

      if (!listResponse.Contents?.length) {
        logger.info('No objects found to copy');
        return;
      }

      for (const object of listResponse.Contents) {
        if (!object.Key) continue;

        const sourceKey = object.Key;
        const fileName = sourceKey.split('/').pop();
        const objectPath = sourceKey.slice(sourcePrefix.length);
        const cleanObjectName = objectPath.startsWith('/') ? objectPath.slice(1) : objectPath;
        let destinationKey: string;

        // Apply specific directory mappings
        const rootLevelFiles = ['model_metadata.json', 'reward_function.py'];
        const isRootLevelFile = fileName && rootLevelFiles.includes(fileName) && !cleanObjectName.includes('/');

        if (isRootLevelFile) {
          destinationKey = `${destinationPrefix}${fileName}`;
        } else {
          destinationKey = `${destinationPrefix}sagemaker-artifacts/${cleanObjectName}`;
        }

        await s3Helper.copyObject(sourceBucket, sourceKey, localDestBucket, destinationKey);
        copied++;
        logger.debug(`Copied file: ${sourceKey} → ${destinationKey}`);
      }

      logger.info(`Successfully copied ${copied} objects`);
    } catch (error) {
      logger.error('Error copying model files', { error, sourceBucket, sourcePrefix });
      throw error;
    }
  }

  /**
   * Creates track configuration from training parameters
   * @param trainingParams Training parameters containing world name and track direction
   * @returns Track configuration
   */
  getTrackConfig(trainingParams: SimulationEnvironmentVariables): TrackConfig {
    const trackId = trainingParams?.WORLD_NAME as TrackId;
    const track = TRACKS.find((t) => t.trackId === trackId);

    let trackDirection: TrackDirection;
    if (track && trackHelper.hasSingleEnabledDirection(trackId)) {
      // For legacy tracks, TRACK_DIRECTION_CLOCKWISE should be undefined, use default direction
      trackDirection = track.defaultDirection;
    } else {
      // For modern tracks, use TRACK_DIRECTION_CLOCKWISE parameter
      trackDirection =
        trainingParams?.TRACK_DIRECTION_CLOCKWISE === true
          ? TrackDirection.CLOCKWISE
          : TrackDirection.COUNTER_CLOCKWISE;
    }

    const trackConfig = {
      trackDirection: trackDirection,
      trackId: trackId,
    };
    return trackConfig;
  }

  /**
   * Convert the data from the training params back into CarCustomization
   * This function reverses the process done in SimulationEnvironmentHelper.addCarCustomization
   * @param trainingParams Training parameters containing car shell and color information
   * @returns Car customization
   */
  getCarCustomization(trainingParams: SimulationEnvironmentVariables): CarCustomization {
    const carCustomization: CarCustomization = {
      carShell: CarShell.DEEPRACER,
      carColor: CarColor.WHITE,
    };

    const shellType = trainingParams?.BODY_SHELL_TYPE;

    if (shellType === DEEPRACER_CAR_SHELL_ID) {
      if (trainingParams.CAR_COLOR) {
        const upperColor = trainingParams.CAR_COLOR.toUpperCase();
        if (upperColor in CarColor) {
          carCustomization.carColor = upperColor as CarColor;
        }
      }
    } else if (shellType) {
      let found = false;

      Object.keys(SimAppCarShells).forEach((shellKey) => {
        if (found) return;
        const shell = shellKey as CarShell;

        const colors = SimAppCarShells[shell];
        Object.keys(colors).forEach((colorKey) => {
          if (found) return;
          const color = colorKey as CarColor;

          if (colors[color] === shellType) {
            carCustomization.carShell = shell;
            carCustomization.carColor = color;
            found = true;
          }
        });
      });
    }
    return carCustomization;
  }

  /**
   * Parse object avoidance config from training parameters
   * This function reverses the process done in SimulationEnvironmentHelper.addObjectAvoidanceConfig
   * @param trainingParams Training parameters containing object avoidance configuration
   * @returns Validated object avoidance configuration
   */
  parseObjectAvoidanceConfig(trainingParams: SimulationEnvironmentVariables): ObjectAvoidanceConfig {
    const { NUMBER_OF_OBSTACLES, OBJECT_POSITIONS, RANDOMIZE_OBSTACLE_LOCATIONS } = trainingParams;

    const objectAvoidanceConfig: ObjectAvoidanceConfig = {
      numberOfObjects: NUMBER_OF_OBSTACLES,
    };

    // Only add objectPositions if:
    // 1. There are defined positions available
    // 2. We're not randomizing obstacle locations
    const hasDefinedObstaclePositions = !!OBJECT_POSITIONS?.length;
    const randomizeObstacles = RANDOMIZE_OBSTACLE_LOCATIONS === true;

    if (hasDefinedObstaclePositions && !randomizeObstacles) {
      objectAvoidanceConfig.objectPositions = OBJECT_POSITIONS.map((positionStr) => {
        const [trackPercentageStr, laneNumberStr] = positionStr.split(',').map((str) => str.trim());
        const objectPosition: ObjectPosition = {
          trackPercentage: parseFloat(trackPercentageStr),
          laneNumber: parseInt(laneNumberStr, 10),
        };

        return objectPosition;
      });
    }
    return objectAvoidanceConfig;
  }

  /**
   * Converts sensor array from DeepRacer format to our internal Sensors object
   * @param sensorArray Array of sensor strings from DeepRacer model metadata
   * @returns Transformed sensors in our internal format
   */
  importSensors(sensorArray: string[] = []): Sensors {
    const sensors: Sensors = {};

    const validCameraSensors = Object.values(CameraSensor);
    const validLidarSensors = Object.values(LidarSensor);

    let foundValidSensor = false;

    for (const sensor of sensorArray) {
      if (validCameraSensors.includes(sensor as CameraSensor)) {
        sensors.camera = sensor as CameraSensor;
        foundValidSensor = true;
      } else if (validLidarSensors.includes(sensor as LidarSensor)) {
        sensors.lidar = sensor as LidarSensor;
        foundValidSensor = true;
      } else {
        logger.warn(`Unrecognized sensor type: ${sensor}. This sensor will be ignored.`);
      }
    }

    if (!foundValidSensor && sensorArray.length > 0) {
      logger.warn('No valid sensors found in the model metadata.');
    }

    return sensors;
  }

  /**
   * Transforms DeepRacer action space format to our internal format
   * @param modelMetadata The DeepRacer model metadata
   * @returns Transformed action space in our internal format
   */
  importActionSpace(modelMetadata: ModelMetadataFile) {
    if (Array.isArray(modelMetadata.action_space)) {
      const discreteActions = modelMetadata.action_space.map((action) => ({
        speed: action.speed,
        steeringAngle: action.steering_angle,
      }));

      return { discrete: discreteActions };
    } else {
      const speed = modelMetadata.action_space.speed;
      const steeringAngle = modelMetadata.action_space.steering_angle;

      return {
        continous: {
          lowSpeed: speed.low,
          highSpeed: speed.high,
          lowSteeringAngle: steeringAngle.low,
          highSteeringAngle: steeringAngle.high,
        },
      };
    }
  }

  /**
   * Converts training algorithm string to AgentAlgorithm enum
   * @param trainingAlgorithm The training algorithm string
   * @returns AgentAlgorithm enum value
   */
  convertToAgentAlgorithm(trainingAlgorithm: string): AgentAlgorithm {
    return trainingAlgorithm === TrainingAlgorithm.SAC ? AgentAlgorithm.SAC : AgentAlgorithm.PPO;
  }

  /**
   * Determines race type from training parameters
   * @param trainingParams Training parameters
   * @returns RaceType enum value
   */
  determineRaceType(trainingParams: SimulationEnvironmentVariables): RaceType {
    return trainingParams?.RACE_TYPE === RaceType.OBJECT_AVOIDANCE ? RaceType.OBJECT_AVOIDANCE : RaceType.TIME_TRIAL;
  }

  /**
   * Constructs track name with direction suffix for reward function validation
   * @param trackConfig Track configuration containing track ID and direction
   * @returns Track name with appropriate suffix for validation
   */
  getTrackNameForValidation(trackConfig: TrackConfig): string {
    if (trackHelper.hasSingleEnabledDirection(trackConfig.trackId)) {
      return trackConfig.trackId;
    }

    const suffix =
      trackConfig.trackDirection === TrackDirection.CLOCKWISE ? CLOCKWISE_TRACK_SUFFIX : COUNTER_CLOCKWISE_TRACK_SUFFIX;

    return `${trackConfig.trackId}${suffix}`;
  }
}
export const importHelper = new ImportHelper();
