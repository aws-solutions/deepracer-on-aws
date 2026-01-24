// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import {
  generateResourceId,
  modelDao,
  ResourceId,
  TEST_MODEL_ITEM,
  TEST_TRAINING_ITEM,
  trainingDao,
} from '@deepracer-indy/database';
import {
  AgentAlgorithm,
  BadRequestError,
  CameraSensor,
  CarColor,
  CarShell,
  ModelStatus,
  RaceType,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { waitForAll } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mockHyperparameters,
  mockMetrics,
  mockModelMetadata,
  mockRewardFunction,
  mockTrainingParams,
  testConstants,
} from '../../../import-workflow/constants/testConstants.js';
import { importHelper } from '../../../import-workflow/utils/ImportHelper.js';
import { ActionSpaceType, TrainingAlgorithm } from '../../../workflow/constants/simulation.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import {
  validateCarCustomization,
  validateContinuousActionSpace,
  validateObjectAvoidanceConfig,
  validateTrackConfig,
} from '../../utils/validation.js';
import { ImportModelOperation, validateRequest } from '../importModel.js';

vi.mock('@deepracer-indy/database');
vi.mock('@deepracer-indy/utils');
vi.mock('#api/utils/validation.js');
vi.mock('#import-workflow/utils/ImportHelper.js');
vi.mock('#utils/clients/sqsClient.js', () => ({
  sqsClient: new SQSClient({}),
}));

const mockSqsClient = mockClient(SQSClient);

describe('ImportModel', () => {
  const validInput = {
    modelName: 'Test-Model',
    modelDescription: 'Test Description',
    s3Bucket: testConstants.s3.sourceBucket,
    s3Path: testConstants.s3.sourcePrefix,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.IMPORT_MODEL_JOB_QUEUE_URL = 'test-queue';
    mockSqsClient.reset();
    mockSqsClient.on(SendMessageCommand).resolves({});

    vi.mocked(generateResourceId).mockReturnValue('test-model-id' as ResourceId);
    vi.mocked(importHelper.parseImportedFiles).mockResolvedValue({
      trainingParams: mockTrainingParams,
      modelMetadata: mockModelMetadata,
      rewardFunction: mockRewardFunction,
      hyperparameters: mockHyperparameters,
    });
    vi.mocked(importHelper.getCarCustomization).mockReturnValue({
      carShell: CarShell.DEEPRACER,
      carColor: CarColor.WHITE,
    });
    vi.mocked(importHelper.getTrackConfig).mockReturnValue({
      trackId: TrackId.OVAL_TRACK,
      trackDirection: TrackDirection.CLOCKWISE,
    });
    vi.mocked(importHelper.getTrackNameForValidation).mockReturnValue(testConstants.trackName);
    vi.mocked(importHelper.determineRaceType).mockReturnValue(RaceType.TIME_TRIAL);
    vi.mocked(importHelper.importActionSpace).mockReturnValue({
      discrete: [
        { speed: 1.0, steeringAngle: 0.0 },
        { speed: 1.5, steeringAngle: 15.0 },
      ],
    });
    vi.mocked(importHelper.convertToAgentAlgorithm).mockReturnValue(AgentAlgorithm.PPO);
    vi.mocked(importHelper.importSensors).mockReturnValue({
      camera: CameraSensor.FRONT_FACING_CAMERA,
    });
    vi.mocked(importHelper.parseMetrics).mockResolvedValue(undefined);
    vi.mocked(validateCarCustomization).mockReturnValue();
    vi.mocked(validateTrackConfig).mockReturnValue();
    vi.mocked(modelDao.create).mockResolvedValue(TEST_MODEL_ITEM);
    vi.mocked(trainingDao.create).mockResolvedValue(TEST_TRAINING_ITEM);
    vi.mocked(waitForAll).mockResolvedValue([TEST_MODEL_ITEM, TEST_TRAINING_ITEM]);
  });

  it('should throw error if required fields are missing', async () => {
    await expect(ImportModelOperation({ ...validInput, modelName: '' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );

    await expect(ImportModelOperation({ ...validInput, s3Bucket: '' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );

    await expect(ImportModelOperation({ ...validInput, s3Path: '' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );
  });

  it('should successfully import model without description', async () => {
    const inputWithoutDescription = {
      modelName: 'Test-Model',
      s3Bucket: testConstants.s3.sourceBucket,
      s3Path: testConstants.s3.sourcePrefix,
    };

    const result = await ImportModelOperation(inputWithoutDescription, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ modelId: 'test-model-id' });
    expect(modelDao.create).toHaveBeenCalledWith({
      modelId: 'test-model-id',
      profileId: TEST_OPERATION_CONTEXT.profileId,
      name: 'Test-Model',
      description: undefined,
      metadata: expect.objectContaining({
        rewardFunction: '',
        hyperparameters: mockHyperparameters,
        agentAlgorithm: AgentAlgorithm.PPO,
      }),
      carCustomization: { carShell: CarShell.DEEPRACER, carColor: CarColor.WHITE },
      status: ModelStatus.IMPORTING,
    });
  });

  it('should successfully import model with TIME_TRIAL race type', async () => {
    const result = await ImportModelOperation(validInput, TEST_OPERATION_CONTEXT);
    expect(result).toEqual({ modelId: 'test-model-id' });
    expect(importHelper.parseImportedFiles).toHaveBeenCalledWith(
      `s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}`,
    );
    expect(validateCarCustomization).toHaveBeenCalled();
    expect(validateTrackConfig).toHaveBeenCalled();
    expect(modelDao.create).toHaveBeenCalledWith({
      modelId: 'test-model-id',
      profileId: TEST_OPERATION_CONTEXT.profileId,
      name: 'Test-Model',
      description: 'Test Description',
      metadata: expect.objectContaining({
        rewardFunction: '',
        hyperparameters: mockHyperparameters,
        agentAlgorithm: AgentAlgorithm.PPO,
      }),
      carCustomization: { carShell: CarShell.DEEPRACER, carColor: CarColor.WHITE },
      status: ModelStatus.IMPORTING,
    });
    expect(mockSqsClient.commandCalls(SendMessageCommand)).toHaveLength(1);
    const sendMessageCall = mockSqsClient.commandCalls(SendMessageCommand)[0];

    expect(sendMessageCall.args[0].input).toEqual(
      expect.objectContaining({
        QueueUrl: 'test-queue',
        MessageBody: expect.stringContaining('"s3Location"'),
      }),
    );

    const messageBodyString = sendMessageCall.args[0].input.MessageBody;
    expect(messageBodyString).toBeDefined();
    const messageBody = JSON.parse(messageBodyString as string);
    expect(messageBody.s3Location).toBe(`s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}`);
    expect(messageBody.profileId).toBe(TEST_OPERATION_CONTEXT.profileId);
    expect(messageBody.modelId).toBe('test-model-id');
    expect(messageBody.modelName).toBe('Test-Model');
    expect(messageBody.modelDescription).toBe('Test Description');
    expect(messageBody.rewardFunction).toBe(mockRewardFunction);
    expect(messageBody.trackConfig).toEqual({
      trackId: TrackId.OVAL_TRACK,
      trackDirection: TrackDirection.CLOCKWISE,
    });
    expect(messageBody.trackName).toBe(testConstants.trackName);
  });

  it('should handle OBJECT_AVOIDANCE race type', async () => {
    const mockObjectAvoidanceConfig = { numberOfObjects: 3 };
    vi.mocked(importHelper.determineRaceType).mockReturnValue(RaceType.OBJECT_AVOIDANCE);
    vi.mocked(importHelper.parseObjectAvoidanceConfig).mockReturnValue(mockObjectAvoidanceConfig);

    await ImportModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(importHelper.parseObjectAvoidanceConfig).toHaveBeenCalled();
    expect(validateObjectAvoidanceConfig).toHaveBeenCalledWith(mockObjectAvoidanceConfig);
    expect(trainingDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        objectAvoidanceConfig: mockObjectAvoidanceConfig,
        raceType: RaceType.OBJECT_AVOIDANCE,
      }),
    );
  });

  it('should validate continuous action space when action space type is continuous', async () => {
    const continuousModelMetadata = {
      ...mockModelMetadata,
      action_space_type: ActionSpaceType.CONTINUOUS,
    };
    const continuousActionSpace = {
      continous: {
        lowSpeed: 0.5,
        highSpeed: 2.0,
        lowSteeringAngle: -30.0,
        highSteeringAngle: 30.0,
      },
    };

    vi.mocked(importHelper.parseImportedFiles).mockResolvedValue({
      trainingParams: mockTrainingParams,
      modelMetadata: continuousModelMetadata,
      rewardFunction: mockRewardFunction,
      hyperparameters: mockHyperparameters,
    });
    vi.mocked(importHelper.importActionSpace).mockReturnValue(continuousActionSpace);

    await ImportModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(validateContinuousActionSpace).toHaveBeenCalledWith(continuousActionSpace.continous);
  });

  it('should throw BadRequestError when SAC algorithm is used with discrete action space', async () => {
    const sacModelMetadata = {
      ...mockModelMetadata,
      training_algorithm: TrainingAlgorithm.SAC,
      action_space_type: ActionSpaceType.DISCRETE,
    };

    vi.mocked(importHelper.parseImportedFiles).mockResolvedValue({
      trainingParams: mockTrainingParams,
      modelMetadata: sacModelMetadata,
      rewardFunction: mockRewardFunction,
      hyperparameters: mockHyperparameters,
    });

    await expect(ImportModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
    await expect(ImportModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Agent algorithm SAC does not work with discrete action space.',
    );
  });

  it('should throw BadRequestError when SAC algorithm has invalid num_episodes_between_training', async () => {
    const sacModelMetadata = {
      ...mockModelMetadata,
      training_algorithm: TrainingAlgorithm.SAC,
      action_space_type: ActionSpaceType.CONTINUOUS,
    };
    const invalidHyperparameters = {
      ...mockHyperparameters,
      num_episodes_between_training: 5,
    };

    vi.mocked(importHelper.parseImportedFiles).mockResolvedValue({
      trainingParams: mockTrainingParams,
      modelMetadata: sacModelMetadata,
      rewardFunction: mockRewardFunction,
      hyperparameters: invalidHyperparameters,
    });

    await expect(ImportModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
    await expect(ImportModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Invalid hyperparameter number of episodes between training for SAC agent algorithm.',
    );
  });

  it('should handle metrics file when present', async () => {
    const mockTrainingItemWithMetrics = {
      ...TEST_TRAINING_ITEM,
      assetS3Locations: {
        metricsS3Location: `s3://${testConstants.s3.destBucket}/metrics-location`,
      },
    };

    vi.mocked(importHelper.parseMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(importHelper.copyMetricsFile).mockResolvedValue();
    vi.mocked(waitForAll).mockResolvedValue([TEST_MODEL_ITEM, mockTrainingItemWithMetrics]);

    await ImportModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(importHelper.parseMetrics).toHaveBeenCalled();
    expect(importHelper.copyMetricsFile).toHaveBeenCalledWith(
      `s3://${testConstants.s3.sourceBucket}/${testConstants.s3.sourcePrefix}`,
      `s3://${testConstants.s3.destBucket}/metrics-location`,
    );
  });
});

describe('validateRequest', () => {
  const baseValidInput = {
    modelName: 'ValidModel',
    s3Bucket: 'test-bucket',
    s3Path: 'test/path',
  };

  describe('required fields validation', () => {
    it('should throw BadRequestError when modelName is missing', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: '' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: '' })).toThrow('Missing required fields');
    });

    it('should throw BadRequestError when s3Bucket is missing', () => {
      expect(() => validateRequest({ ...baseValidInput, s3Bucket: '' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, s3Bucket: '' })).toThrow('Missing required fields');
    });

    it('should throw BadRequestError when s3Path is missing', () => {
      expect(() => validateRequest({ ...baseValidInput, s3Path: '' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, s3Path: '' })).toThrow('Missing required fields');
    });

    it('should throw BadRequestError when multiple required fields are missing', () => {
      expect(() => validateRequest({ modelName: '', s3Bucket: '', s3Path: '' })).toThrow(BadRequestError);
      expect(() => validateRequest({ modelName: '', s3Bucket: '', s3Path: '' })).toThrow('Missing required fields');
    });
  });

  describe('modelName validation', () => {
    it('should accept modelName with only alphanumeric characters', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'ModelName123' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: 'UPPERCASE' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: 'lowercase' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: '12345' })).not.toThrow();
    });

    it('should accept modelName with hyphens', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model-Name' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model-Name-123' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: 'a-b-c-d-e' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: '123-456-789' })).not.toThrow();
    });

    it('should accept modelName with mixed case and hyphens', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'MyModel-v1' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: 'DeepRacer-Model-2024' })).not.toThrow();
    });

    it('should reject modelName with spaces', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model Name' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model Name' })).toThrow(
        'Model name must contain only alphanumeric characters and hyphens; and must be less than or equal to 64 characters in length',
      );
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model Name 123' })).toThrow(BadRequestError);
    });

    it('should reject modelName with underscores', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model_Name' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model_Name' })).toThrow(
        'Model name must contain only alphanumeric characters and hyphens; and must be less than or equal to 64 characters in length',
      );
    });

    it('should reject modelName with special characters', () => {
      const specialChars = [
        '@',
        '!',
        '#',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')',
        '+',
        '=',
        '[',
        ']',
        '{',
        '}',
        '|',
        '\\',
        '/',
        '<',
        '>',
        '?',
        '.',
        ',',
        ';',
        ':',
        '"',
        "'",
      ];

      for (const char of specialChars) {
        expect(() => validateRequest({ ...baseValidInput, modelName: `Model${char}Name` })).toThrow(BadRequestError);
        expect(() => validateRequest({ ...baseValidInput, modelName: `Model${char}Name` })).toThrow(
          'Model name must contain only alphanumeric characters and hyphens; and must be less than or equal to 64 characters in length',
        );
      }
    });

    it('should reject modelName with unicode characters', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model™Name' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model©Name' })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Model😀Name' })).toThrow(BadRequestError);
    });

    it('should accept modelName at maximum length (64 characters)', () => {
      const maxLengthName = 'a'.repeat(64);
      expect(() => validateRequest({ ...baseValidInput, modelName: maxLengthName })).not.toThrow();
    });

    it('should reject modelName exceeding maximum length (65+ characters)', () => {
      const tooLongName = 'a'.repeat(65);
      expect(() => validateRequest({ ...baseValidInput, modelName: tooLongName })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: tooLongName })).toThrow(
        'Model name must contain only alphanumeric characters and hyphens; and must be less than or equal to 64 characters in length',
      );
    });
  });

  describe('modelDescription validation', () => {
    it('should accept valid input without modelDescription', () => {
      expect(() => validateRequest(baseValidInput)).not.toThrow();
    });

    it('should accept modelDescription with undefined', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: undefined })).not.toThrow();
    });

    it('should accept modelDescription with alphanumeric characters', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Description123' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'UPPERCASE' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'lowercase' })).not.toThrow();
    });

    it('should accept modelDescription with spaces', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test Description' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Model Description 123' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'A B C D E' })).not.toThrow();
    });

    it('should accept modelDescription with hyphens', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test-Description' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Model-Description-123' })).not.toThrow();
    });

    it('should accept modelDescription with spaces and hyphens', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test Description-v1' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'DeepRacer Model - 2024' })).not.toThrow();
    });

    it('should reject modelDescription with underscores', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test_Description' })).toThrow(
        BadRequestError,
      );
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test_Description' })).toThrow(
        'Model description must contain only alphanumeric characters, spaces, and hyphen; and must be less than or equal to 255 characters in length',
      );
    });

    it('should reject modelDescription with special characters', () => {
      const specialChars = [
        '@',
        '!',
        '#',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')',
        '+',
        '=',
        '[',
        ']',
        '{',
        '}',
        '|',
        '\\',
        '/',
        '<',
        '>',
        '?',
        '.',
        ',',
        ';',
        ':',
        '"',
        "'",
      ];

      for (const char of specialChars) {
        expect(() => validateRequest({ ...baseValidInput, modelDescription: `Test${char}Description` })).toThrow(
          BadRequestError,
        );
        expect(() => validateRequest({ ...baseValidInput, modelDescription: `Test${char}Description` })).toThrow(
          'Model description must contain only alphanumeric characters, spaces, and hyphen; and must be less than or equal to 255 characters in length',
        );
      }
    });

    it('should reject modelDescription with unicode characters', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test™Description' })).toThrow(
        BadRequestError,
      );
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test©Description' })).toThrow(
        BadRequestError,
      );
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test😀Description' })).toThrow(
        BadRequestError,
      );
    });

    it('should accept modelDescription at maximum length (255 characters)', () => {
      const maxLengthDesc = 'a'.repeat(255);
      expect(() => validateRequest({ ...baseValidInput, modelDescription: maxLengthDesc })).not.toThrow();
    });

    it('should reject modelDescription exceeding maximum length (256+ characters)', () => {
      const tooLongDesc = 'a'.repeat(256);
      expect(() => validateRequest({ ...baseValidInput, modelDescription: tooLongDesc })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelDescription: tooLongDesc })).toThrow(
        'Model description must contain only alphanumeric characters, spaces, and hyphen; and must be less than or equal to 255 characters in length',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle modelName at boundary of valid characters', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: 'a' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: 'Z' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: '0' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: '9' })).not.toThrow();
      expect(() => validateRequest({ ...baseValidInput, modelName: '-' })).not.toThrow();
    });

    it('should reject very long modelName exceeding 64 characters', () => {
      const longName = 'a'.repeat(100);
      expect(() => validateRequest({ ...baseValidInput, modelName: longName })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelName: longName })).toThrow(
        'Model name must contain only alphanumeric characters and hyphens; and must be less than or equal to 64 characters in length',
      );
    });

    it('should reject very long modelDescription exceeding 255 characters', () => {
      const longDesc = 'a '.repeat(150); // Results in 300 characters
      expect(() => validateRequest({ ...baseValidInput, modelDescription: longDesc })).toThrow(BadRequestError);
      expect(() => validateRequest({ ...baseValidInput, modelDescription: longDesc })).toThrow(
        'Model description must contain only alphanumeric characters, spaces, and hyphen; and must be less than or equal to 255 characters in length',
      );
    });

    it('should handle modelName with only hyphens', () => {
      expect(() => validateRequest({ ...baseValidInput, modelName: '---' })).not.toThrow();
    });

    it('should handle modelDescription with multiple consecutive spaces', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: 'Test    Description' })).not.toThrow();
    });

    it('should handle modelDescription with leading and trailing spaces', () => {
      expect(() => validateRequest({ ...baseValidInput, modelDescription: '  Test Description  ' })).not.toThrow();
    });
  });
});
