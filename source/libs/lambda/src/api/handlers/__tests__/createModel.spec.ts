// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  modelDao,
  TEST_MODEL_ITEM,
  TEST_MODEL_ITEMS,
  TEST_TRAINING_ITEM,
  TEST_ACCOUNT_RESOURCE_USAGE_NORMAL,
  TEST_PROFILE_ITEM_WITH_LIMITS,
  TEST_PROFILE_ITEM,
  TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS,
  trainingDao,
  accountResourceUsageDao,
  profileDao,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  CarColor,
  CarCustomization,
  CarShell,
  InternalFailureError,
  JobStatus,
  ModelDefinition,
  ModelStatus,
  TrackConfig,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';

import { sqsClient } from '../../../utils/clients/sqsClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { rewardFunctionValidator } from '../../utils/RewardFunctionValidator.js';
import { validator } from '../../utils/Validator.js';
import { CreateModelOperation } from '../createModel.js';

describe('CreateModel', () => {
  const testModelDefinition: ModelDefinition = {
    name: TEST_MODEL_ITEM.name,
    carCustomization: TEST_MODEL_ITEM.carCustomization,
    description: TEST_MODEL_ITEM.description,
    metadata: TEST_MODEL_ITEM.metadata,
    trainingConfig: {
      maxTimeInMinutes: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      raceType: TEST_TRAINING_ITEM.raceType,
      trackConfig: TEST_TRAINING_ITEM.trackConfig,
    },
  };
  const mockSqsClient = mockClient(sqsClient);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  beforeEach(() => {
    mockSqsClient.reset();
  });

  it('should create new model', async () => {
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM));
    vi.spyOn(modelDao, 'create').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(trainingDao, 'create').mockResolvedValue(TEST_TRAINING_ITEM);
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockResolvedValueOnce({ errors: [] });
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM);
    const metricsLoggerSpy = vi.spyOn(metricsLogger, 'logCreateModel').mockImplementation(() => undefined);

    await expect(
      CreateModelOperation({ modelDefinition: testModelDefinition }, TEST_OPERATION_CONTEXT),
    ).resolves.toEqual({ modelId: TEST_MODEL_ITEM.modelId });

    expect(rewardFunctionValidator.validateRewardFunction).toHaveBeenCalledWith({
      rewardFunction: testModelDefinition.metadata.rewardFunction,
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });
    expect(metricsLoggerSpy).toHaveBeenCalledWith();
    expect(modelDao.create).toHaveBeenCalledWith({
      modelId: expect.any(String),
      profileId: TEST_OPERATION_CONTEXT.profileId,
      carCustomization: testModelDefinition.carCustomization,
      description: testModelDefinition.description,
      metadata: testModelDefinition.metadata,
      name: testModelDefinition.name,
      status: ModelStatus.QUEUED,
    });
    expect(trainingDao.create).toHaveBeenCalledWith({
      modelId: expect.any(String),
      profileId: TEST_OPERATION_CONTEXT.profileId,
      objectAvoidanceConfig: testModelDefinition.trainingConfig.objectAvoidanceConfig,
      raceType: testModelDefinition.trainingConfig.raceType,
      status: JobStatus.QUEUED,
      terminationConditions: { maxTimeInMinutes: testModelDefinition.trainingConfig.maxTimeInMinutes },
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });
    expect(accountResourceUsageUpdate).toHaveBeenCalledWith(
      { year: currentYear, month: currentMonth },
      {
        accountComputeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      },
    );
    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { computeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes },
    );
  });

  it('should create new cloned model when passed preTrainedModelId', async () => {
    const mockPreTrainedModelId = TEST_MODEL_ITEMS[1].modelId;
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(modelDao, 'create').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(trainingDao, 'create').mockResolvedValue(TEST_TRAINING_ITEM);
    vi.spyOn(validator, 'validateCloneModel').mockResolvedValueOnce();
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockResolvedValueOnce({ errors: [] });
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateModelOperation(
        { modelDefinition: testModelDefinition, preTrainedModelId: mockPreTrainedModelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).resolves.toEqual({ modelId: TEST_MODEL_ITEM.modelId });

    expect(validator.validateCloneModel).toHaveBeenCalledWith(
      TEST_OPERATION_CONTEXT.profileId,
      mockPreTrainedModelId,
      testModelDefinition,
    );
    expect(rewardFunctionValidator.validateRewardFunction).toHaveBeenCalledWith({
      rewardFunction: testModelDefinition.metadata.rewardFunction,
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });
    expect(modelDao.create).toHaveBeenCalledWith({
      modelId: expect.any(String),
      profileId: TEST_OPERATION_CONTEXT.profileId,
      clonedFromModelId: mockPreTrainedModelId,
      carCustomization: testModelDefinition.carCustomization,
      description: testModelDefinition.description,
      metadata: testModelDefinition.metadata,
      name: testModelDefinition.name,
      status: ModelStatus.QUEUED,
    });
    expect(trainingDao.create).toHaveBeenCalledWith({
      modelId: expect.any(String),
      profileId: TEST_OPERATION_CONTEXT.profileId,
      objectAvoidanceConfig: testModelDefinition.trainingConfig.objectAvoidanceConfig,
      raceType: testModelDefinition.trainingConfig.raceType,
      status: JobStatus.QUEUED,
      terminationConditions: { maxTimeInMinutes: testModelDefinition.trainingConfig.maxTimeInMinutes },
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });
    expect(mockSqsClient).toHaveReceivedCommand(SendMessageCommand);
    expect(accountResourceUsageUpdate).toHaveBeenCalledWith(
      { year: currentYear, month: currentMonth },
      {
        accountComputeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      },
    );
    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { computeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes },
    );
  });

  it('should throw error if a request input is invalid', async () => {
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateModelOperation(
        {
          modelDefinition: {
            ...testModelDefinition,
            trainingConfig: {
              maxTimeInMinutes: 1,
              raceType: TEST_TRAINING_ITEM.raceType,
              trackConfig: TEST_TRAINING_ITEM.trackConfig,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Max time in minutes is invalid.' }));
    expect(accountResourceUsageUpdate).not.toHaveBeenCalled();
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if modelItem fails to be created', async () => {
    const error = new InternalFailureError({ message: 'Item failed to create' });
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(modelDao, 'create').mockRejectedValueOnce(error);
    vi.spyOn(trainingDao, 'create').mockResolvedValue(TEST_TRAINING_ITEM);
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockResolvedValueOnce({ errors: [] });
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);

    await expect(
      CreateModelOperation({ modelDefinition: testModelDefinition }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(error);

    expect(rewardFunctionValidator.validateRewardFunction).toHaveBeenCalledWith({
      rewardFunction: testModelDefinition.metadata.rewardFunction,
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });

    expect(accountResourceUsageUpdate).toHaveBeenCalledWith(
      { year: currentYear, month: currentMonth },
      {
        accountComputeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      },
    );

    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      {
        computeMinutesQueued:
          (TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS.computeMinutesQueued ?? 0) +
          TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      },
    );
  });

  it('should throw error if trainingItem fails to be created', async () => {
    const error = new InternalFailureError({ message: 'Item failed to create' });
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(modelDao, 'create').mockResolvedValueOnce(TEST_MODEL_ITEM);
    vi.spyOn(trainingDao, 'create').mockRejectedValueOnce(error);
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockResolvedValueOnce({ errors: [] });
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateModelOperation({ modelDefinition: testModelDefinition }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(error);

    expect(rewardFunctionValidator.validateRewardFunction).toHaveBeenCalledWith({
      rewardFunction: testModelDefinition.metadata.rewardFunction,
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });

    expect(accountResourceUsageUpdate).toHaveBeenCalledWith(
      { year: currentYear, month: currentMonth },
      {
        accountComputeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      },
    );

    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { computeMinutesQueued: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes },
    );
  });

  it('should throw error if reward function validation fails', async () => {
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(modelDao, 'create').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(trainingDao, 'create').mockResolvedValue(TEST_TRAINING_ITEM);
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockRejectedValueOnce(
      new BadRequestError({ message: 'Reward function invalid' }),
    );
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateModelOperation({ modelDefinition: testModelDefinition }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);

    expect(rewardFunctionValidator.validateRewardFunction).toHaveBeenCalledWith({
      rewardFunction: testModelDefinition.metadata.rewardFunction,
      trackConfig: testModelDefinition.trainingConfig.trackConfig,
    });

    expect(accountResourceUsageUpdate).not.toHaveBeenCalled();
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if car customization is invalid', async () => {
    const invalidCarCustomization: CarCustomization = {
      carColor: CarColor.BLACK,
      carShell: CarShell.F1,
    };
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateModelOperation(
        { modelDefinition: { ...testModelDefinition, carCustomization: invalidCarCustomization } },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrowError(BadRequestError);

    expect(accountResourceUsageUpdate).not.toHaveBeenCalled();
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if track config is invalid', async () => {
    const invalidTrackConfig: TrackConfig = {
      trackId: TrackId.DBRO_RACEWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    };
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValueOnce(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateModelOperation(
        {
          modelDefinition: {
            ...testModelDefinition,
            trainingConfig: { ...testModelDefinition.trainingConfig, trackConfig: invalidTrackConfig },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrowError(BadRequestError);

    expect(accountResourceUsageUpdate).not.toHaveBeenCalled();
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if requested compute minutes exceeds maximum total compute minutes available', async () => {
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS));
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockResolvedValueOnce({ errors: [] });
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
    await expect(
      CreateModelOperation(
        {
          modelDefinition: {
            ...testModelDefinition,
            trainingConfig: {
              ...testModelDefinition.trainingConfig,
              maxTimeInMinutes: 1000,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Total compute minutes for the month exceeded.',
      }),
    );
    expect(accountResourceUsageUpdate).not.toHaveBeenCalled();
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if requested model count exceeds maximum model count available', async () => {
    const accountResourceUsageUpdate = vi
      .spyOn(accountResourceUsageDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL));
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS));
    vi.spyOn(rewardFunctionValidator, 'validateRewardFunction').mockResolvedValueOnce({ errors: [] });
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce({
      ...TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS,
      modelCount: 3,
      maxModelCount: 3,
    });
    await expect(
      CreateModelOperation({ modelDefinition: testModelDefinition }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Total number of models for the month exceeded.',
      }),
    );
    expect(accountResourceUsageUpdate).not.toHaveBeenCalled();
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });
});
