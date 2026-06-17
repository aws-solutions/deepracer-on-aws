// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  modelDao,
  type LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_SUBMISSION_ID_1,
  TEST_MODEL_ID_1,
  TEST_PROFILE_ID_1,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  InternalFailureError,
  LiveEventStatus,
  LiveQueueItemStatus,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { RemoveLiveQueueItemOperation } from '../removeLiveQueueItem.js';

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  currentExecutionArn: '',
};

const PENDING_ITEM = {
  ...TEST_LIVE_QUEUE_ITEM,
  submissionId: TEST_SUBMISSION_ID_1,
  status: LiveQueueItemStatus.PENDING,
};

describe('RemoveLiveQueueItem', () => {
  beforeEach(() => {
    vi.spyOn(modelDao, 'update').mockResolvedValue(undefined as never);
  });

  it('should remove a pending item successfully', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockResolvedValue(null);

    const result = await RemoveLiveQueueItemOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result).toStrictEqual({});
    expect(liveQueueItemDao.remove).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_1,
    });
    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: TEST_PROFILE_ID_1, modelId: TEST_MODEL_ID_1 },
      { status: ModelStatus.READY },
    );
  });

  it('should remove a failed item successfully', async () => {
    const failedItem = { ...PENDING_ITEM, status: LiveQueueItemStatus.FAILED };
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(failedItem);
    vi.spyOn(liveQueueItemDao, 'remove').mockResolvedValue(null);

    const result = await RemoveLiveQueueItemOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result).toStrictEqual({});
    expect(liveQueueItemDao.remove).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_1,
    });
  });

  it('should throw BadRequestError if leaderboard is not live', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Not a live race.' }));
  });

  it('should throw BadRequestError if race is completed', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
    });

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot modify after race closed.' }));
  });

  it('should throw BadRequestError if submissionId not found in queue', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(null);

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Invalid submissionId.' }));
  });

  it.each([LiveQueueItemStatus.IN_PROGRESS, LiveQueueItemStatus.COMPLETED])(
    'should throw BadRequestError if item status is %s',
    async (status) => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
      vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue({ ...PENDING_ITEM, status });

      await expect(
        RemoveLiveQueueItemOperation(
          { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot remove COMPLETED or IN_PROGRESS items.' }));
    },
  );

  it('should propagate error if leaderboard not found', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should throw ConflictError if remove fails with ConditionalCheckFailedException', async () => {
    const condError = Object.assign(new Error('conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockRejectedValue(condError);

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Item status changed. Please refresh and try again.' }));
  });

  it('should propagate error if remove fails', async () => {
    const error = new InternalFailureError({ message: 'DynamoDB error' });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockRejectedValue(error);

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(error);
  });

  it('should throw ConflictError if remove fails via err.cause.name', async () => {
    const wrappedError = Object.assign(new Error('wrapped'), {
      cause: { name: 'ConditionalCheckFailedException' },
    });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockRejectedValue(wrappedError);

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Item status changed. Please refresh and try again.' }));
  });

  it('should throw ConflictError if remove fails via message includes conditional', async () => {
    const msgError = new Error('The conditional request failed');
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockRejectedValue(msgError);

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Item status changed. Please refresh and try again.' }));
  });

  it('should allow removal when race is SCHEDULED', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.SCHEDULED,
    });
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockResolvedValue(null);

    const result = await RemoveLiveQueueItemOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result).toStrictEqual({});
  });

  it('should succeed even if modelDao.update throws during model status restoration', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue(PENDING_ITEM);
    vi.spyOn(liveQueueItemDao, 'remove').mockResolvedValue(null);
    vi.spyOn(modelDao, 'update').mockRejectedValue(new Error('DynamoDB error'));

    await expect(
      RemoveLiveQueueItemOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).resolves.toStrictEqual({});
  });

  it('should reset model to READY using modelId from queue item', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'get').mockResolvedValue({
      ...PENDING_ITEM,
      status: LiveQueueItemStatus.FAILED,
    });
    vi.spyOn(liveQueueItemDao, 'remove').mockResolvedValue(null);

    await RemoveLiveQueueItemOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: TEST_PROFILE_ID_1, modelId: TEST_MODEL_ID_1 },
      { status: ModelStatus.READY },
    );
  });
});
