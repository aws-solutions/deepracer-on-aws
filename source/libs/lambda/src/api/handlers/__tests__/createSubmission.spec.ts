// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SQSClient } from '@aws-sdk/client-sqs';
import {
  leaderboardDao,
  LeaderboardItem,
  modelDao,
  submissionDao,
  TEST_LEADERBOARD_ITEM,
  TEST_MODEL_ITEM,
  TEST_SUBMISSION_ITEM,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  JobStatus,
  ModelStatus,
  RaceType,
} from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateSubmissionOperation } from '../createSubmission.js';

describe('CreateSubmission operation', () => {
  const mockSqsClient = mockClient(SQSClient);
  const READY_MODEL = { ...TEST_MODEL_ITEM, status: ModelStatus.READY };
  const OPEN_LEADERBOARD_ITEM: LeaderboardItem = {
    ...TEST_LEADERBOARD_ITEM,
    openTime: new Date(Date.now() - 86400000).toISOString(),
    closeTime: new Date(Date.now() + 86400000).toISOString(),
  };
  const ITEM_FAILED_TO_CREATE_ERROR = new InternalFailureError({ message: 'Item failed to create' });

  beforeEach(() => {
    mockSqsClient.reset();
  });

  it('should create new submission', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(OPEN_LEADERBOARD_ITEM);
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({ cursor: null, data: [] });
    vi.spyOn(modelDao, 'update').mockResolvedValueOnce(TEST_MODEL_ITEM);
    vi.spyOn(submissionDao, 'create').mockResolvedValueOnce(TEST_SUBMISSION_ITEM);

    const output = await CreateSubmissionOperation(
      { leaderboardId: OPEN_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.submissionId).toEqual(TEST_SUBMISSION_ITEM.submissionId);
    expect(modelDao.load).toHaveBeenCalledTimes(1);
    expect(modelDao.update).toHaveBeenCalledTimes(1);
    expect(leaderboardDao.load).toHaveBeenCalledTimes(1);
    expect(submissionDao.listByCreatedAt).toHaveBeenCalledTimes(1);
    expect(submissionDao.create).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      modelId: TEST_MODEL_ITEM.modelId,
      modelName: TEST_MODEL_ITEM.name,
      status: JobStatus.QUEUED,
      objectAvoidanceConfig: OPEN_LEADERBOARD_ITEM.objectAvoidanceConfig,
      resettingBehaviorConfig: OPEN_LEADERBOARD_ITEM.resettingBehaviorConfig,
      raceType: OPEN_LEADERBOARD_ITEM.raceType,
      terminationConditions: {
        maxLaps: OPEN_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
        maxTimeInMinutes: OPEN_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes ?? 20,
      },
      trackConfig: OPEN_LEADERBOARD_ITEM.trackConfig,
      leaderboardId: OPEN_LEADERBOARD_ITEM.leaderboardId,
      submissionNumber: 1,
    });
    expect(mockSqsClient.calls()).toHaveLength(1);
  });

  it('should include object avoidance config for object avoidance leaderboard', async () => {
    const MOCK_OA_LEADERBOARD_ITEM = {
      ...OPEN_LEADERBOARD_ITEM,
      raceType: RaceType.OBJECT_AVOIDANCE,
      objectAvoidanceConfig: {
        numberOfObjects: 3,
      },
    } satisfies LeaderboardItem;

    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(MOCK_OA_LEADERBOARD_ITEM);
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({ cursor: null, data: [] });
    vi.spyOn(modelDao, 'update').mockResolvedValueOnce(TEST_MODEL_ITEM);
    vi.spyOn(submissionDao, 'create').mockResolvedValueOnce(TEST_SUBMISSION_ITEM);

    const output = await CreateSubmissionOperation(
      { leaderboardId: MOCK_OA_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.submissionId).toEqual(TEST_SUBMISSION_ITEM.submissionId);
    expect(modelDao.load).toHaveBeenCalledTimes(1);
    expect(modelDao.update).toHaveBeenCalledTimes(1);
    expect(leaderboardDao.load).toHaveBeenCalledTimes(1);
    expect(submissionDao.listByCreatedAt).toHaveBeenCalledTimes(1);
    expect(submissionDao.create).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      modelId: TEST_MODEL_ITEM.modelId,
      modelName: TEST_MODEL_ITEM.name,
      status: JobStatus.QUEUED,
      objectAvoidanceConfig: MOCK_OA_LEADERBOARD_ITEM.objectAvoidanceConfig,
      resettingBehaviorConfig: MOCK_OA_LEADERBOARD_ITEM.resettingBehaviorConfig,
      raceType: MOCK_OA_LEADERBOARD_ITEM.raceType,
      terminationConditions: {
        maxLaps: MOCK_OA_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
        maxTimeInMinutes: MOCK_OA_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes ?? 20,
      },
      trackConfig: MOCK_OA_LEADERBOARD_ITEM.trackConfig,
      leaderboardId: MOCK_OA_LEADERBOARD_ITEM.leaderboardId,
      submissionNumber: 1,
    });
    expect(mockSqsClient.calls()).toHaveLength(1);
  });

  it('should throw error if model is not in READY state', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(TEST_MODEL_ITEM);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(OPEN_LEADERBOARD_ITEM);

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Model is not in a submittable state.' }));
  });

  it('should throw error if leaderboard is not open', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() + 86300000).toISOString(),
      closeTime: new Date(Date.now() + 86400000).toISOString(),
    });

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'The leaderboard is not accepting submissions.' }));
  });

  it('should throw error if submitting to closed leaderboard', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() - 86300000).toISOString(),
      closeTime: new Date(Date.now() - 86400000).toISOString(),
    });

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'The leaderboard is not accepting submissions.' }));
  });

  it('should throw error if max user submission limit has been reached', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() - 86300000).toISOString(),
      closeTime: new Date(Date.now() + 86400000).toISOString(),
      maxSubmissionsPerUser: 3,
    });
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({
      cursor: null,
      data: [{ ...TEST_SUBMISSION_ITEM, submissionNumber: 3 }],
    });

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Max number of submissions has been reached.' }));
  });

  it('should throw error if model item fails to load', async () => {
    vi.spyOn(modelDao, 'load').mockRejectedValueOnce(ITEM_FAILED_TO_CREATE_ERROR);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(OPEN_LEADERBOARD_ITEM);

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(ITEM_FAILED_TO_CREATE_ERROR);
  });

  it('should throw error if leaderboard item fails to load', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockRejectedValueOnce(ITEM_FAILED_TO_CREATE_ERROR);

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(ITEM_FAILED_TO_CREATE_ERROR);
  });

  it('should throw error if submission items failed to be retrieved', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(OPEN_LEADERBOARD_ITEM);
    vi.spyOn(submissionDao, 'listByCreatedAt').mockRejectedValueOnce(ITEM_FAILED_TO_CREATE_ERROR);

    return expect(
      CreateSubmissionOperation(
        { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(ITEM_FAILED_TO_CREATE_ERROR);
  });
});
