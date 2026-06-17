// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SQSClient } from '@aws-sdk/client-sqs';
import {
  leaderboardDao,
  liveQueueItemDao,
  LeaderboardItem,
  modelDao,
  profileDao,
  submissionDao,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_MODEL_ITEM,
  TEST_PROFILE_ITEM,
  TEST_SUBMISSION_ITEM,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  JobStatus,
  LiveEventStatus,
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

  // --- Live race submission tests ---

  describe('Live race submissions', () => {
    const LIVE_LEADERBOARD: LeaderboardItem = {
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.SCHEDULED,
      liveEventTime: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour in the future
      submissionPeriodOpen: false,
    };

    it('should create live race submission atomically via addToQueue', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(LIVE_LEADERBOARD);
      vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValueOnce([]);
      vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({ cursor: null, data: [] });
      vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM);
      vi.spyOn(liveQueueItemDao, 'addToQueue').mockResolvedValueOnce(TEST_LIVE_QUEUE_ITEM);
      vi.spyOn(modelDao, 'update').mockResolvedValueOnce(TEST_MODEL_ITEM);

      const output = await CreateSubmissionOperation(
        { leaderboardId: LIVE_LEADERBOARD.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.submissionId).toEqual(TEST_LIVE_QUEUE_ITEM.submissionId);
      expect(liveQueueItemDao.addToQueue).toHaveBeenCalledTimes(1);
      expect(liveQueueItemDao.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: TEST_OPERATION_CONTEXT.profileId,
          modelId: TEST_MODEL_ITEM.modelId,
          modelName: TEST_MODEL_ITEM.name,
          participantName: TEST_PROFILE_ITEM.alias,
          leaderboardId: LIVE_LEADERBOARD.leaderboardId,
        }),
      );
      // Should NOT send SQS message for live race
      expect(mockSqsClient.calls()).toHaveLength(0);
    });

    it('should accept submissions just before liveEventTime', async () => {
      const almostExpiredLeaderboard: LeaderboardItem = {
        ...LIVE_LEADERBOARD,
        liveEventTime: new Date(Date.now() + 1_000).toISOString(), // 1 second from now
      };

      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(almostExpiredLeaderboard);
      vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValueOnce([]);
      vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({ cursor: null, data: [] });
      vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM);
      vi.spyOn(liveQueueItemDao, 'addToQueue').mockResolvedValueOnce(TEST_LIVE_QUEUE_ITEM);
      vi.spyOn(modelDao, 'update').mockResolvedValueOnce(TEST_MODEL_ITEM);

      const output = await CreateSubmissionOperation(
        { leaderboardId: almostExpiredLeaderboard.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.submissionId).toEqual(TEST_LIVE_QUEUE_ITEM.submissionId);
    });

    it('should reject submissions after liveEventTime when submissionPeriodOpen is false', async () => {
      const pastEventLeaderboard: LeaderboardItem = {
        ...LIVE_LEADERBOARD,
        liveEventTime: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
        submissionPeriodOpen: false,
      };

      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(pastEventLeaderboard);

      await expect(
        CreateSubmissionOperation(
          { leaderboardId: pastEventLeaderboard.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Submissions closed.' }));
    });

    it('should accept submissions after liveEventTime when submissionPeriodOpen is true', async () => {
      const reopenedLeaderboard: LeaderboardItem = {
        ...LIVE_LEADERBOARD,
        liveEventTime: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
        submissionPeriodOpen: true,
      };

      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(reopenedLeaderboard);
      vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValueOnce([]);
      vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({ cursor: null, data: [] });
      vi.spyOn(profileDao, 'load').mockResolvedValueOnce(TEST_PROFILE_ITEM);
      vi.spyOn(liveQueueItemDao, 'addToQueue').mockResolvedValueOnce(TEST_LIVE_QUEUE_ITEM);
      vi.spyOn(modelDao, 'update').mockResolvedValueOnce(TEST_MODEL_ITEM);

      const output = await CreateSubmissionOperation(
        { leaderboardId: reopenedLeaderboard.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.submissionId).toEqual(TEST_LIVE_QUEUE_ITEM.submissionId);
    });

    it('should throw error if max submissions reached for live race', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce({ ...LIVE_LEADERBOARD, maxSubmissionsPerUser: 1 });
      vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValueOnce([]);
      vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValueOnce({
        cursor: null,
        data: [{ ...TEST_SUBMISSION_ITEM, submissionNumber: 1 }],
      });

      await expect(
        CreateSubmissionOperation(
          { leaderboardId: LIVE_LEADERBOARD.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Max number of submissions has been reached.' }));
    });

    it('should reject duplicate model submission in live race', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce(LIVE_LEADERBOARD);
      vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValueOnce([
        { ...TEST_LIVE_QUEUE_ITEM, modelId: TEST_MODEL_ITEM.modelId },
      ]);

      await expect(
        CreateSubmissionOperation(
          { leaderboardId: LIVE_LEADERBOARD.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'This model has already been submitted to this race.' }));
    });

    it('should reject submissions when live event is completed', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValueOnce(READY_MODEL);
      vi.spyOn(leaderboardDao, 'load').mockResolvedValueOnce({
        ...LIVE_LEADERBOARD,
        liveEventStatus: LiveEventStatus.COMPLETED,
      });

      await expect(
        CreateSubmissionOperation(
          { leaderboardId: LIVE_LEADERBOARD.leaderboardId, modelId: TEST_MODEL_ITEM.modelId },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Submissions closed.' }));
    });
  });
});
