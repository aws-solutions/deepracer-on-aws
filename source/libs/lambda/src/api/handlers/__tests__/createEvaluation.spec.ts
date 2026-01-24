// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SQSClient } from '@aws-sdk/client-sqs';
import {
  evaluationDao,
  modelDao,
  accountResourceUsageDao,
  profileDao,
  TEST_EVALUATION_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_MODEL_ITEM,
  TEST_ACCOUNT_RESOURCE_USAGE_EMPTY,
  TEST_ACCOUNT_RESOURCE_USAGE_MAX,
  TEST_ACCOUNT_RESOURCE_USAGE_NORMAL,
  TEST_PROFILE_ITEM_WITH_LIMITS,
  TEST_PROFILE_ITEM,
  TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  EvaluationConfig,
  JobStatus,
  ModelStatus,
  RaceType,
  TrackConfig,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateEvaluationOperation } from '../createEvaluation.js';

const TEST_EVALUATION_CONFIG: EvaluationConfig = {
  evaluationName: 'test-evaluation',
  maxLaps: 2,
  maxTimeInMinutes: 10,
  objectAvoidanceConfig: {
    numberOfObjects: 3,
    objectPositions: [
      { laneNumber: -1, trackPercentage: 0.1 },
      { laneNumber: 1, trackPercentage: 0.24 },
      { laneNumber: -1, trackPercentage: 0.37 },
    ],
  },
  raceType: RaceType.TIME_TRIAL,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  trackConfig: {
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
    trackId: TrackId.ACE_SPEEDWAY,
  },
};

const TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS: EvaluationConfig = {
  evaluationName: 'test-evaluation-randomized',
  maxLaps: 2,
  maxTimeInMinutes: 10,
  objectAvoidanceConfig: {
    numberOfObjects: 3,
    objectPositions: [], // Empty array for randomized positions
  },
  raceType: RaceType.OBJECT_AVOIDANCE,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  trackConfig: {
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
    trackId: TrackId.ACE_SPEEDWAY,
  },
};

describe('CreateEvaluation operation', () => {
  const mockSqsClient = mockClient(SQSClient);

  it('should create new evaluation', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM));
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
    vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(evaluationDao, 'create').mockResolvedValue(TEST_EVALUATION_ITEM);
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM);

    const output = await CreateEvaluationOperation(
      { evaluationConfig: TEST_EVALUATION_CONFIG, modelId: TEST_EVALUATION_ITEM.modelId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluationId).toEqual(TEST_EVALUATION_ITEM.evaluationId);
    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId, modelId: TEST_EVALUATION_ITEM.modelId },
      { status: ModelStatus.QUEUED },
    );
    expect(evaluationDao.create).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      modelId: TEST_EVALUATION_ITEM.modelId,
      evaluationName: TEST_EVALUATION_CONFIG.evaluationName,
      objectAvoidanceConfig: undefined,
      raceType: TEST_EVALUATION_CONFIG.raceType,
      resettingBehaviorConfig: TEST_EVALUATION_CONFIG.resettingBehaviorConfig,
      status: JobStatus.QUEUED,
      terminationConditions: {
        maxLaps: TEST_EVALUATION_CONFIG.maxLaps,
        maxTimeInMinutes: TEST_EVALUATION_CONFIG.maxTimeInMinutes,
      },
      trackConfig: TEST_EVALUATION_CONFIG.trackConfig,
    });
    expect(mockSqsClient.calls()).toHaveLength(1);
    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { computeMinutesQueued: 10 },
    );
  });

  it('should create new evaluation (normal quota usage)', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS));
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
    vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(evaluationDao, 'create').mockResolvedValue(TEST_EVALUATION_ITEM);
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);

    const output = await CreateEvaluationOperation(
      { evaluationConfig: TEST_EVALUATION_CONFIG, modelId: TEST_EVALUATION_ITEM.modelId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluationId).toEqual(TEST_EVALUATION_ITEM.evaluationId);
    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { computeMinutesQueued: 110 },
    );
  });

  it('should create new evaluation with randomized object positions (empty array)', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM));
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
    vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(evaluationDao, 'create').mockResolvedValue(TEST_EVALUATION_ITEM);
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM);

    const output = await CreateEvaluationOperation(
      { evaluationConfig: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS, modelId: TEST_EVALUATION_ITEM.modelId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluationId).toEqual(TEST_EVALUATION_ITEM.evaluationId);
    expect(evaluationDao.create).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      modelId: TEST_EVALUATION_ITEM.modelId,
      evaluationName: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS.evaluationName,
      objectAvoidanceConfig: {
        numberOfObjects: 3,
        objectPositions: [], // Should preserve empty array for randomized positions
      },
      raceType: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS.raceType,
      resettingBehaviorConfig: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS.resettingBehaviorConfig,
      status: JobStatus.QUEUED,
      terminationConditions: {
        maxLaps: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS.maxLaps,
        maxTimeInMinutes: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS.maxTimeInMinutes,
      },
      trackConfig: TEST_EVALUATION_CONFIG_RANDOMIZED_OBJECTS.trackConfig,
    });
    expect(profileDaoUpdate).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { computeMinutesQueued: 10 },
    );
  });

  it('should throw error if requested compute minutes exceeds maximum total compute minutes available', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS));
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
    vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(evaluationDao, 'create').mockResolvedValue(TEST_EVALUATION_ITEM);
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_MAX);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_USAGE_AND_LIMITS);
    await expect(
      CreateEvaluationOperation(
        {
          evaluationConfig: {
            ...TEST_EVALUATION_CONFIG,
            maxTimeInMinutes: 1000,
          },
          modelId: TEST_EVALUATION_ITEM.modelId,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Total compute minutes for the month exceeded.',
      }),
    );
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if termination conditions is invalid', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);
    await expect(
      CreateEvaluationOperation(
        { evaluationConfig: { ...TEST_EVALUATION_CONFIG, maxTimeInMinutes: 1 }, modelId: TEST_EVALUATION_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Max time in minutes is invalid.' }));
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if object avoidance config is invalid', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);
    await expect(
      CreateEvaluationOperation(
        {
          evaluationConfig: {
            ...TEST_EVALUATION_CONFIG,
            raceType: RaceType.OBJECT_AVOIDANCE,
            objectAvoidanceConfig: {
              numberOfObjects: 2,
              objectPositions: [
                { trackPercentage: 1, laneNumber: 1 },
                { trackPercentage: 0.4, laneNumber: 1 },
              ],
            },
          },
          modelId: TEST_EVALUATION_ITEM.modelId,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Last obstacle position is invalid.' }));
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if track config is invalid', async () => {
    const invalidTrackConfig: TrackConfig = {
      trackId: TrackId.DBRO_RACEWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    };
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateEvaluationOperation(
        {
          evaluationConfig: { ...TEST_EVALUATION_CONFIG, trackConfig: invalidTrackConfig },
          modelId: TEST_EVALUATION_ITEM.modelId,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrowError(BadRequestError);
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if model is not in ready status', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateEvaluationOperation(
        { evaluationConfig: TEST_EVALUATION_CONFIG, modelId: TEST_EVALUATION_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Model is not ready for evaluation.' }));
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });

  it('should throw error if model item does not exist', async () => {
    const profileDaoUpdate = vi
      .spyOn(profileDao, 'update')
      .mockImplementation(() => Promise.resolve(TEST_PROFILE_ITEM_WITH_LIMITS));
    vi.spyOn(modelDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);
    vi.spyOn(accountResourceUsageDao, 'getOrCreate').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'create').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(accountResourceUsageDao, 'update').mockResolvedValue(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM_WITH_LIMITS);

    await expect(
      CreateEvaluationOperation(
        { evaluationConfig: TEST_EVALUATION_CONFIG, modelId: TEST_EVALUATION_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toEqual(TEST_ITEM_NOT_FOUND_ERROR);
    expect(profileDaoUpdate).not.toHaveBeenCalled();
  });
});
