// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AgentAlgorithm,
  CameraSensor,
  CarColor,
  CarShell,
  LidarSensor,
  RaceType,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, logger, s3Helper, waitForAll } from '@deepracer-indy/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as YAML from 'yaml';

import { DEEPRACER_CAR_SHELL_ID, TrainingAlgorithm } from '../../../workflow/constants/simulation.js';
import type { SimulationEnvironmentVariables } from '../../../workflow/types/simulationEnvironmentVariables.js';
import {
  mockModelMetadata,
  mockDiscreteModelMetadata,
  mockHyperparameters,
  mockTrainingParams,
  mockRewardFunction,
  mockMetrics,
  testConstants,
} from '../../constants/testConstants.js';
import { importHelper } from '../../utils/ImportHelper.js';

const mockS3Location = `s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}`;
const mockProfileId = testConstants.ids.profile;
const mockModelId = testConstants.ids.model;

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  s3Helper: {
    getObjectAsStringFromS3: vi.fn(),
    listObjects: vi.fn(),
    copyObject: vi.fn(),
  },
  AmazonS3URI: vi.fn(),
  waitForAll: vi.fn(),
  tracer: {
    captureAWSv3Client: vi.fn((client) => client),
  },
  logMethod: vi.fn((target, propertyKey, descriptor) => descriptor),
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
  stringify: vi.fn((data) => JSON.stringify(data)),
}));

vi.mock('#workflow/constants/simulation.js', () => ({
  DEEPRACER_CAR_SHELL_ID: 'deepracer',
  SimAppCarShells: {
    [CarShell.DEEPRACER]: {
      [CarColor.WHITE]: 'deepracer',
      [CarColor.RED]: 'deepracer',
    },
    [CarShell.F1]: {
      [CarColor.BLUE]: 'f1_2021_blue',
      [CarColor.RED]: 'f1_2021',
    },
  },
  TrainingAlgorithm: {
    [AgentAlgorithm.PPO]: 'clipped_ppo',
    [AgentAlgorithm.SAC]: 'sac',
  },
  ActionSpaceType: {
    CONTINUOUS: 'continuous',
    DISCRETE: 'discrete',
  },
  SIM_APP_VERSION: 6,
}));

describe('ImportHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MODEL_DATA_BUCKET_NAME = testConstants.s3.sourceBucket;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.MODEL_DATA_BUCKET_NAME;
  });

  describe('parseModelMetadata', () => {
    it('should parse model metadata from S3', async () => {
      const mockMetadataString = JSON.stringify(mockModelMetadata);
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue(mockMetadataString);

      const result = await importHelper.parseModelMetadata(mockS3Location);

      expect(result).toEqual(mockModelMetadata);
      expect(s3Helper.getObjectAsStringFromS3).toHaveBeenCalledWith(
        `${mockS3Location}${testConstants.paths.modelMetadata}`,
      );
      expect(logger.info).toHaveBeenCalledWith('Retrieved model metadata', { modelMetadata: mockModelMetadata });
    });

    it('should throw error when S3 call fails', async () => {
      const error = new Error('S3 error');
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockRejectedValue(error);

      await expect(importHelper.parseModelMetadata(mockS3Location)).rejects.toThrow('S3 error');
    });

    it('should throw error when JSON parsing fails', async () => {
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue('invalid json');

      await expect(importHelper.parseModelMetadata(mockS3Location)).rejects.toThrow();
    });

    it('should throw error when S3 returns empty string', async () => {
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue('');

      await expect(importHelper.parseModelMetadata(mockS3Location)).rejects.toThrow(
        `Model metadata not found at ${mockS3Location}/model_metadata.json`,
      );
    });
  });

  describe('parseRewardFunction', () => {
    it('should parse reward function from S3', async () => {
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue(mockRewardFunction);

      const result = await importHelper.parseRewardFunction(mockS3Location);

      expect(result).toBe(mockRewardFunction);
      expect(s3Helper.getObjectAsStringFromS3).toHaveBeenCalledWith(
        `${mockS3Location}${testConstants.paths.rewardFunction}`,
      );
      expect(logger.info).toHaveBeenCalledWith('Retrieved reward function', { rewardFunction: mockRewardFunction });
    });

    it('should throw error when S3 call fails', async () => {
      const error = new Error('S3 error');
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockRejectedValue(error);

      await expect(importHelper.parseRewardFunction(mockS3Location)).rejects.toThrow('S3 error');
    });

    it('should throw error when S3 returns empty string', async () => {
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue('');

      await expect(importHelper.parseRewardFunction(mockS3Location)).rejects.toThrow(
        `Reward function not found at ${mockS3Location}/reward_function.py`,
      );
    });
  });

  describe('parseHyperparameters', () => {
    it('should parse hyperparameters from S3', async () => {
      const mockHyperparametersString = JSON.stringify(mockHyperparameters);
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue(mockHyperparametersString);

      const result = await importHelper.parseHyperparameters(mockS3Location);

      expect(result).toEqual(mockHyperparameters);
      expect(s3Helper.getObjectAsStringFromS3).toHaveBeenCalledWith(
        `${mockS3Location}${testConstants.paths.hyperparameters}`,
      );
      expect(logger.info).toHaveBeenCalledWith('Retrieved hyperparameters', { hyperparameters: mockHyperparameters });
    });

    it('should throw error when S3 call fails', async () => {
      const error = new Error('S3 error');
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockRejectedValue(error);

      await expect(importHelper.parseHyperparameters(mockS3Location)).rejects.toThrow('S3 error');
    });

    it('should throw error when S3 returns empty string', async () => {
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue('');

      await expect(importHelper.parseHyperparameters(mockS3Location)).rejects.toThrow(
        `Hyperparameters not found at ${mockS3Location}/ip/hyperparameters.json`,
      );
    });
  });

  describe('parseTrainingParams', () => {
    it('should parse training parameters from YAML in S3', async () => {
      const mockYamlString = 'WORLD_NAME: reinvent_base\ntrack_direction: clockwise';
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue(mockYamlString);
      vi.mocked(YAML.parse).mockReturnValue(mockTrainingParams);

      const result = await importHelper.parseTrainingParams(mockS3Location);

      expect(result).toEqual(mockTrainingParams);
      expect(s3Helper.getObjectAsStringFromS3).toHaveBeenCalledWith(
        `${mockS3Location}${testConstants.paths.trainingParams}`,
      );
      expect(YAML.parse).toHaveBeenCalledWith(mockYamlString);
      expect(logger.info).toHaveBeenCalledWith('Parsed training params from YAML', {
        trainingParams: mockTrainingParams,
      });
    });

    it('should throw error when S3 call fails', async () => {
      const error = new Error('S3 error');
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockRejectedValue(error);

      await expect(importHelper.parseTrainingParams(mockS3Location)).rejects.toThrow('S3 error');
    });

    it('should throw error when S3 returns empty string', async () => {
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue('');

      await expect(importHelper.parseTrainingParams(mockS3Location)).rejects.toThrow(
        `Training params not found at ${mockS3Location}/training_params.yaml`,
      );
    });
  });

  describe('parseMetrics', () => {
    beforeEach(() => {
      vi.mocked(AmazonS3URI).mockImplementation(() => ({
        bucket: testConstants.s3.sourceBucket,
        key: testConstants.s3.sourcePrefix,
        uri: 'test-uri',
      }));
    });

    it('should parse metrics file when found', async () => {
      const mockListResponse = {
        Contents: [
          { Key: `${testConstants.s3.sourcePrefix}${testConstants.paths.metricsTraining}training-20231201.json` },
          { Key: `${testConstants.s3.sourcePrefix}${testConstants.paths.metricsTraining}other-file.txt` },
        ],
        $metadata: {},
      };
      const mockMetricsString = JSON.stringify(mockMetrics);

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue(mockMetricsString);

      const result = await importHelper.parseMetrics(mockS3Location);

      expect(result).toEqual(mockMetrics);
      expect(s3Helper.listObjects).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourcePrefix}${testConstants.paths.metricsTraining}`,
      );
      expect(s3Helper.getObjectAsStringFromS3).toHaveBeenCalledWith(
        `s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}${testConstants.paths.metricsTraining}training-20231201.json`,
      );
      expect(logger.info).toHaveBeenCalledWith('Retrieved metrics', { metrics: mockMetrics });
    });

    it('should return undefined when no training metrics file found', async () => {
      const mockListResponse = {
        Contents: [
          { Key: `${testConstants.s3.sourceBucket}${testConstants.paths.metricsTraining}other-file.txt` },
          { Key: `${testConstants.s3.sourceBucket}${testConstants.paths.metricsTraining}not-training.json` },
        ],
        $metadata: {},
      };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);

      const result = await importHelper.parseMetrics(mockS3Location);

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('No training metrics file found with pattern training-*.json');
    });

    it('should return undefined when no files in metrics directory', async () => {
      const mockListResponse = { Contents: [], $metadata: {} };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);

      const result = await importHelper.parseMetrics(mockS3Location);

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('No training metrics file found with pattern training-*.json');
    });

    it('should throw error when metrics file is empty', async () => {
      const mockListResponse = {
        Contents: [
          { Key: `${testConstants.s3.sourcePrefix}${testConstants.paths.metricsTraining}training-20231201.json` },
        ],
        $metadata: {},
      };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);
      vi.mocked(s3Helper.getObjectAsStringFromS3).mockResolvedValue('');

      await expect(importHelper.parseMetrics(mockS3Location)).rejects.toThrow(
        `Metrics not found at s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}${testConstants.paths.metricsTraining}training-20231201.json`,
      );
    });
  });

  describe('copyMetricsFile', () => {
    const mockDestinationS3Location = `s3://${testConstants.s3.destBucket}/${testConstants.s3.destPrefix}`;

    beforeEach(() => {
      vi.mocked(AmazonS3URI)
        .mockImplementationOnce(() => ({
          bucket: testConstants.s3.sourceBucket,
          key: testConstants.s3.sourcePrefix,
          uri: 'source-uri',
        }))
        .mockImplementationOnce(() => ({
          bucket: testConstants.s3.destBucket,
          key: testConstants.s3.destPrefix,
          uri: 'dest-uri',
        }));
    });

    it('should copy metrics file when found', async () => {
      const mockListResponse = {
        Contents: [
          { Key: `${testConstants.s3.sourceBucket}${testConstants.paths.metricsTraining}training-20231201.json` },
        ],
        $metadata: {},
      };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);
      vi.mocked(s3Helper.copyObject).mockResolvedValue({ $metadata: {} });

      await importHelper.copyMetricsFile(mockS3Location, mockDestinationS3Location);

      expect(s3Helper.copyObject).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourceBucket}${testConstants.paths.metricsTraining}training-20231201.json`,
        testConstants.s3.destBucket,
        testConstants.s3.destPrefix,
      );
      expect(logger.info).toHaveBeenCalledWith('Successfully copied metrics file', {
        sourceKey: `${testConstants.s3.sourceBucket}${testConstants.paths.metricsTraining}training-20231201.json`,
        destinationKey: testConstants.s3.destPrefix,
      });
    });

    it('should do nothing when no training metrics file found', async () => {
      const mockListResponse = {
        Contents: [],
        $metadata: {},
      };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);

      await importHelper.copyMetricsFile(mockS3Location, mockDestinationS3Location);

      expect(s3Helper.copyObject).not.toHaveBeenCalled();
    });
  });

  describe('parseImportedFiles', () => {
    it('should parse all imported files', async () => {
      const mockMetadataString = JSON.stringify(mockModelMetadata);
      const mockHyperparametersString = JSON.stringify(mockHyperparameters);
      const mockYamlString = 'world_name: reinvent_base';

      vi.mocked(s3Helper.getObjectAsStringFromS3)
        .mockResolvedValueOnce(mockYamlString)
        .mockResolvedValueOnce(mockMetadataString)
        .mockResolvedValueOnce(mockRewardFunction)
        .mockResolvedValueOnce(mockHyperparametersString);

      vi.mocked(YAML.parse).mockReturnValue(mockTrainingParams);
      vi.mocked(waitForAll).mockResolvedValue([
        mockTrainingParams,
        mockModelMetadata,
        mockRewardFunction,
        mockHyperparameters,
      ]);
      const result = await importHelper.parseImportedFiles(mockS3Location);
      expect(result).toEqual({
        trainingParams: mockTrainingParams,
        modelMetadata: mockModelMetadata,
        rewardFunction: mockRewardFunction,
        hyperparameters: mockHyperparameters,
      });
      expect(s3Helper.getObjectAsStringFromS3).toHaveBeenCalledTimes(4);
    });
  });

  describe('copyModelFiles', () => {
    beforeEach(() => {
      vi.mocked(AmazonS3URI).mockImplementation(() => ({
        bucket: testConstants.s3.sourceBucket,
        key: `${testConstants.s3.sourcePrefix}/`,
        uri: 'source-uri',
      }));
    });

    it('should copy model files from source to destination with file mapping expected in User Data S3 Bucket', async () => {
      const mockListResponse = {
        Contents: [
          { Key: `${testConstants.s3.sourceBucket}/model_metadata.json` },
          { Key: `${testConstants.s3.sourceBucket}/reward_function.py` },
          { Key: `${testConstants.s3.sourceBucket}/model/model.tar.gz` },
          { Key: `${testConstants.s3.sourceBucket}/output/hyperparameters.json` },
          { Key: `${testConstants.s3.sourceBucket}/model/model_metadata.json` },
        ],
        $metadata: {},
      };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);
      vi.mocked(s3Helper.copyObject).mockResolvedValue({ $metadata: {} });

      await importHelper.copyModelFiles(mockS3Location, mockProfileId, mockModelId);

      expect(s3Helper.listObjects).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourcePrefix}/`,
      );
      expect(s3Helper.copyObject).toHaveBeenCalledTimes(5);

      expect(s3Helper.copyObject).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourceBucket}/model_metadata.json`,
        testConstants.s3.sourceBucket,
        `${mockProfileId}/models/${mockModelId}/model_metadata.json`,
      );

      expect(s3Helper.copyObject).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourceBucket}/reward_function.py`,
        testConstants.s3.sourceBucket,
        `${mockProfileId}/models/${mockModelId}/reward_function.py`,
      );

      expect(s3Helper.copyObject).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourceBucket}/model/model.tar.gz`,
        testConstants.s3.sourceBucket,
        `${mockProfileId}/models/${mockModelId}/sagemaker-artifacts/model/model.tar.gz`,
      );
      expect(s3Helper.copyObject).toHaveBeenCalledWith(
        testConstants.s3.sourceBucket,
        `${testConstants.s3.sourceBucket}/model/model_metadata.json`,
        testConstants.s3.sourceBucket,
        `${mockProfileId}/models/${mockModelId}/sagemaker-artifacts/model/model_metadata.json`,
      );

      expect(logger.info).toHaveBeenCalledWith('Successfully copied 5 objects');
    });

    it('should skip objects without Key', async () => {
      const mockListResponse = {
        Contents: [{}, { Key: `${testConstants.s3.sourceBucket}/model_metadata.json` }],
        $metadata: {},
      };

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);
      vi.mocked(s3Helper.copyObject).mockResolvedValue({ $metadata: {} });

      await importHelper.copyModelFiles(mockS3Location, mockProfileId, mockModelId);

      expect(s3Helper.copyObject).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Successfully copied 1 objects');
    });

    it('should handle empty source directory', async () => {
      const mockListResponse = { Contents: [], $metadata: {} };
      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);

      await importHelper.copyModelFiles(mockS3Location, mockProfileId, mockModelId);

      expect(s3Helper.copyObject).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('No objects found to copy');
    });

    it('should throw error when MODEL_DATA_BUCKET_NAME is not defined', async () => {
      delete process.env.MODEL_DATA_BUCKET_NAME;

      await expect(importHelper.copyModelFiles(mockS3Location, mockProfileId, mockModelId)).rejects.toThrow(
        'MODEL_DATA_BUCKET_NAME environment variable is not defined',
      );
      expect(AmazonS3URI).toHaveBeenCalledWith(mockS3Location);
    });

    it('should handle copy errors', async () => {
      const mockListResponse = {
        Contents: [{ Key: 'source-prefix/model_metadata.json' }],
        $metadata: {},
      };
      const copyError = new Error('Copy failed');

      vi.mocked(s3Helper.listObjects).mockResolvedValue(mockListResponse);
      vi.mocked(s3Helper.copyObject).mockRejectedValue(copyError);

      await expect(importHelper.copyModelFiles(mockS3Location, mockProfileId, mockModelId)).rejects.toThrow(
        'Copy failed',
      );
      expect(logger.error).toHaveBeenCalledWith('Error copying model files', expect.any(Object));
    });
  });

  describe('getTrackConfig', () => {
    it('should create clockwise track config for modern track', () => {
      const trainingParams = {
        ...mockTrainingParams,
        TRACK_DIRECTION_CLOCKWISE: true,
        WORLD_NAME: '2022_april_open', // Modern track with multiple directions
      } as SimulationEnvironmentVariables;

      const result = importHelper.getTrackConfig(trainingParams);

      expect(result).toEqual({
        trackDirection: TrackDirection.CLOCKWISE,
        trackId: '2022_april_open',
      });
    });

    it('should create counter-clockwise track config for modern track', () => {
      const trainingParams = {
        ...mockTrainingParams,
        TRACK_DIRECTION_CLOCKWISE: false,
        WORLD_NAME: '2022_april_open', // Modern track with multiple directions
      } as SimulationEnvironmentVariables;

      const result = importHelper.getTrackConfig(trainingParams);

      expect(result).toEqual({
        trackDirection: TrackDirection.COUNTER_CLOCKWISE,
        trackId: '2022_april_open',
      });
    });

    it('should use default direction for legacy track with single direction', () => {
      const trainingParams = {
        WORLD_NAME: 'reinvent_base', // Legacy track with single direction
        BODY_SHELL_TYPE: 'deepracer',
        CAR_COLOR: 'white',
        RACE_TYPE: RaceType.TIME_TRIAL,
        NUMBER_OF_OBSTACLES: 0,
        OBJECT_POSITIONS: [],
        RANDOMIZE_OBSTACLE_LOCATIONS: false,
      } as Partial<SimulationEnvironmentVariables> as SimulationEnvironmentVariables;

      const result = importHelper.getTrackConfig(trainingParams);

      expect(result).toEqual({
        trackDirection: TrackDirection.COUNTER_CLOCKWISE,
        trackId: 'reinvent_base',
      });
    });
  });

  describe('getCarCustomization', () => {
    it('should return default DEEPRACER with WHITE color for DEEPRACER shell', () => {
      const trainingParams = {
        ...mockTrainingParams,
        BODY_SHELL_TYPE: DEEPRACER_CAR_SHELL_ID,
        CAR_COLOR: 'white',
      } as SimulationEnvironmentVariables;

      const result = importHelper.getCarCustomization(trainingParams);

      expect(result).toEqual({
        carShell: CarShell.DEEPRACER,
        carColor: CarColor.WHITE,
      });
    });

    it('should handle different color for DEEPRACER shell', () => {
      const trainingParams = {
        ...mockTrainingParams,
        BODY_SHELL_TYPE: DEEPRACER_CAR_SHELL_ID,
        CAR_COLOR: 'red',
      } as SimulationEnvironmentVariables;

      const result = importHelper.getCarCustomization(trainingParams);

      expect(result).toEqual({
        carShell: CarShell.DEEPRACER,
        carColor: CarColor.RED,
      });
    });

    it('should find matching shell and color for non-DEEPRACER shells', () => {
      const trainingParams = {
        ...mockTrainingParams,
        BODY_SHELL_TYPE: 'f1_2021',
      } as SimulationEnvironmentVariables;

      const result = importHelper.getCarCustomization(trainingParams);

      expect(result).toEqual({
        carShell: CarShell.F1,
        carColor: CarColor.RED,
      });
    });

    it('should return default values when shell is not found', () => {
      const trainingParams = {
        ...mockTrainingParams,
        BODY_SHELL_TYPE: 'unknown_shell',
      } as SimulationEnvironmentVariables;

      const result = importHelper.getCarCustomization(trainingParams);

      expect(result).toEqual({
        carShell: CarShell.DEEPRACER,
        carColor: CarColor.WHITE,
      });
    });

    it('should handle missing shell type', () => {
      const trainingParams = { ...mockTrainingParams } as SimulationEnvironmentVariables;

      const result = importHelper.getCarCustomization(trainingParams);

      expect(result).toEqual({
        carShell: CarShell.DEEPRACER,
        carColor: CarColor.WHITE,
      });
    });
  });

  describe('parseObjectAvoidanceConfig', () => {
    it('should parse object avoidance config with defined positions', () => {
      const trainingParams = {
        ...mockTrainingParams,
        NUMBER_OF_OBSTACLES: 3,
        OBJECT_POSITIONS: ['0.2, 1', '0.5, 2', '0.8, 1'],
        RANDOMIZE_OBSTACLE_LOCATIONS: false,
      } as SimulationEnvironmentVariables;

      const result = importHelper.parseObjectAvoidanceConfig(trainingParams);

      expect(result).toEqual({
        numberOfObjects: 3,
        objectPositions: [
          { trackPercentage: 0.2, laneNumber: 1 },
          { trackPercentage: 0.5, laneNumber: 2 },
          { trackPercentage: 0.8, laneNumber: 1 },
        ],
      });
    });

    it('should not include objectPositions when randomizing obstacles', () => {
      const trainingParams = {
        ...mockTrainingParams,
        NUMBER_OF_OBSTACLES: 2,
        OBJECT_POSITIONS: ['0.3, 1', '0.7, 2'],
        RANDOMIZE_OBSTACLE_LOCATIONS: true,
      } as SimulationEnvironmentVariables;

      const result = importHelper.parseObjectAvoidanceConfig(trainingParams);

      expect(result).toEqual({
        numberOfObjects: 2,
      });
      expect(result.objectPositions).toBeUndefined();
    });

    it('should not include objectPositions when no positions are defined', () => {
      const trainingParams = {
        ...mockTrainingParams,
        NUMBER_OF_OBSTACLES: 1,
        OBJECT_POSITIONS: [],
        RANDOMIZE_OBSTACLE_LOCATIONS: false,
      } as SimulationEnvironmentVariables;

      const result = importHelper.parseObjectAvoidanceConfig(trainingParams);

      expect(result).toEqual({
        numberOfObjects: 1,
      });
      expect(result.objectPositions).toBeUndefined();
    });

    it('should handle missing OBJECT_POSITIONS', () => {
      const trainingParams = {
        ...mockTrainingParams,
        NUMBER_OF_OBSTACLES: 2,
        RANDOMIZE_OBSTACLE_LOCATIONS: false,
      } as SimulationEnvironmentVariables;

      const result = importHelper.parseObjectAvoidanceConfig(trainingParams);

      expect(result).toEqual({
        numberOfObjects: 2,
      });
    });
  });

  describe('importSensors', () => {
    it('should import valid camera sensor', () => {
      const sensorArray = ['FRONT_FACING_CAMERA'];

      const result = importHelper.importSensors(sensorArray);

      expect(result).toEqual({
        camera: CameraSensor.FRONT_FACING_CAMERA,
      });
    });

    it('should import valid lidar sensor', () => {
      const sensorArray = ['LIDAR'];

      const result = importHelper.importSensors(sensorArray);

      expect(result).toEqual({
        lidar: LidarSensor.LIDAR,
      });
    });

    it('should import both camera and lidar sensors', () => {
      const sensorArray = ['FRONT_FACING_CAMERA', 'LIDAR'];

      const result = importHelper.importSensors(sensorArray);

      expect(result).toEqual({
        camera: CameraSensor.FRONT_FACING_CAMERA,
        lidar: LidarSensor.LIDAR,
      });
    });

    it('should ignore unrecognized sensors and log warning', () => {
      const sensorArray = ['FRONT_FACING_CAMERA', 'UNKNOWN_SENSOR', 'LIDAR'];

      const result = importHelper.importSensors(sensorArray);

      expect(result).toEqual({
        camera: CameraSensor.FRONT_FACING_CAMERA,
        lidar: LidarSensor.LIDAR,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Unrecognized sensor type: UNKNOWN_SENSOR. This sensor will be ignored.',
      );
    });

    it('should handle empty sensor array', () => {
      const result = importHelper.importSensors([]);

      expect(result).toEqual({});
    });

    it('should handle undefined sensor array', () => {
      const result = importHelper.importSensors();

      expect(result).toEqual({});
    });

    it('should log warning when no valid sensors found in non-empty array', () => {
      const sensorArray = ['INVALID_SENSOR_1', 'INVALID_SENSOR_2'];

      const result = importHelper.importSensors(sensorArray);

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith('No valid sensors found in the model metadata.');
    });
  });

  describe('importActionSpace', () => {
    it('should import continuous action space', () => {
      const result = importHelper.importActionSpace(mockModelMetadata);

      expect(result).toEqual({
        continous: {
          lowSpeed: 1.0,
          highSpeed: 4.0,
          lowSteeringAngle: -30.0,
          highSteeringAngle: 30.0,
        },
      });
    });

    it('should import discrete action space', () => {
      const result = importHelper.importActionSpace(mockDiscreteModelMetadata);

      expect(result).toEqual({
        discrete: [
          { speed: 1.0, steeringAngle: -30.0 },
          { speed: 2.0, steeringAngle: 0.0 },
          { speed: 3.0, steeringAngle: 30.0 },
        ],
      });
    });
  });

  describe('convertToAgentAlgorithm', () => {
    it('should convert SAC to AgentAlgorithm.SAC', () => {
      const result = importHelper.convertToAgentAlgorithm(TrainingAlgorithm.SAC);

      expect(result).toBe(AgentAlgorithm.SAC);
    });

    it('should convert PPO to AgentAlgorithm.PPO', () => {
      const result = importHelper.convertToAgentAlgorithm(TrainingAlgorithm.PPO);

      expect(result).toBe(AgentAlgorithm.PPO);
    });

    it('should default to PPO for unknown algorithm', () => {
      const result = importHelper.convertToAgentAlgorithm('unknown_algorithm');

      expect(result).toBe(AgentAlgorithm.PPO);
    });
  });

  describe('determineRaceType', () => {
    it('should return OBJECT_AVOIDANCE when race type is OBJECT_AVOIDANCE', () => {
      const trainingParams = {
        ...mockTrainingParams,
        RACE_TYPE: RaceType.OBJECT_AVOIDANCE,
      } as SimulationEnvironmentVariables;

      const result = importHelper.determineRaceType(trainingParams);

      expect(result).toBe(RaceType.OBJECT_AVOIDANCE);
    });

    it('should return TIME_TRIAL when race type is TIME_TRIAL', () => {
      const trainingParams = {
        ...mockTrainingParams,
        RACE_TYPE: RaceType.TIME_TRIAL,
      } as SimulationEnvironmentVariables;

      const result = importHelper.determineRaceType(trainingParams);

      expect(result).toBe(RaceType.TIME_TRIAL);
    });

    it('should default to TIME_TRIAL when race type is undefined', () => {
      const trainingParams = { ...mockTrainingParams } as SimulationEnvironmentVariables;

      const result = importHelper.determineRaceType(trainingParams);

      expect(result).toBe(RaceType.TIME_TRIAL);
    });
  });

  describe('getTrackNameForValidation', () => {
    it('should return track name without suffix for legacy track', () => {
      const trackConfig = {
        trackId: TrackId.REINVENT_2018,
        trackDirection: TrackDirection.COUNTER_CLOCKWISE,
      };

      const result = importHelper.getTrackNameForValidation(trackConfig);

      expect(result).toBe(trackConfig.trackId);
    });

    it('should return track name with clockwise suffix for modern track', () => {
      const trackConfig = {
        trackId: TrackId.ACE_SPEEDWAY,
        trackDirection: TrackDirection.CLOCKWISE,
      };

      const result = importHelper.getTrackNameForValidation(trackConfig);

      expect(result).toBe('2022_april_open_cw');
    });

    it('should return track name with counter-clockwise suffix for modern track', () => {
      const trackConfig = {
        trackId: TrackId.ACE_SPEEDWAY,
        trackDirection: TrackDirection.COUNTER_CLOCKWISE,
      };

      const result = importHelper.getTrackNameForValidation(trackConfig);

      expect(result).toBe('2022_april_open_ccw');
    });
  });
});
