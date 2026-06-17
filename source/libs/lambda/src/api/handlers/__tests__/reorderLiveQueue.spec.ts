// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  type LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_SUBMISSION_ID_1,
  TEST_SUBMISSION_ID_2,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  LiveEventStatus,
  LiveQueueItemStatus,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ReorderLiveQueueOperation } from '../reorderLiveQueue.js';

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  currentExecutionArn: '',
};

const PENDING_ITEM_1 = { ...TEST_LIVE_QUEUE_ITEM, submissionId: TEST_SUBMISSION_ID_1, queuePosition: 'a0' };
const PENDING_ITEM_2 = {
  ...TEST_LIVE_QUEUE_ITEM,
  submissionId: TEST_SUBMISSION_ID_2,
  queuePosition: 'a1',
};

describe('ReorderLiveQueue', () => {
  it('should reorder item to front when no afterSubmissionId provided', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([PENDING_ITEM_1, PENDING_ITEM_2]);
    vi.spyOn(liveQueueItemDao, 'reorder').mockResolvedValue({ ...PENDING_ITEM_2, queuePosition: 'Zz' });

    const result = await ReorderLiveQueueOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_2 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result.item.submissionId).toBe(TEST_SUBMISSION_ID_2);
    expect(result.item.submittedAt).toBeInstanceOf(Date);
    expect(liveQueueItemDao.reorder).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_2,
      afterSubmissionId: null,
      queue: [PENDING_ITEM_1, PENDING_ITEM_2],
    });
  });

  it('should reorder item after another submission', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([PENDING_ITEM_1, PENDING_ITEM_2]);
    vi.spyOn(liveQueueItemDao, 'reorder').mockResolvedValue({ ...PENDING_ITEM_2, queuePosition: 'a0V' });

    const result = await ReorderLiveQueueOperation(
      {
        leaderboardId: TEST_LEADERBOARD_ID,
        submissionId: TEST_SUBMISSION_ID_2,
        afterSubmissionId: TEST_SUBMISSION_ID_1,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(result.item.submissionId).toBe(TEST_SUBMISSION_ID_2);
    expect(liveQueueItemDao.reorder).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_2,
      afterSubmissionId: TEST_SUBMISSION_ID_1,
      queue: [PENDING_ITEM_1, PENDING_ITEM_2],
    });
  });

  it('should throw BadRequestError if leaderboard is not live', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      ReorderLiveQueueOperation(
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
      ReorderLiveQueueOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot modify after race closed.' }));
  });

  it('should throw BadRequestError when submissionId equals afterSubmissionId', async () => {
    await expect(
      ReorderLiveQueueOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          submissionId: TEST_SUBMISSION_ID_1,
          afterSubmissionId: TEST_SUBMISSION_ID_1,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot reorder item after itself.' }));
  });

  it('should throw BadRequestError if submissionId not found in queue', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([PENDING_ITEM_1]);

    await expect(
      ReorderLiveQueueOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_2 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Invalid submissionId.' }));
  });

  it.each([LiveQueueItemStatus.IN_PROGRESS, LiveQueueItemStatus.COMPLETED, LiveQueueItemStatus.FAILED])(
    'should throw BadRequestError if item status is %s',
    async (status) => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
      vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([{ ...PENDING_ITEM_1, status }]);

      await expect(
        ReorderLiveQueueOperation(
          { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Can only reorder pending items.' }));
    },
  );

  it('should throw BadRequestError if afterSubmissionId not found in queue', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([PENDING_ITEM_1]);

    await expect(
      ReorderLiveQueueOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          submissionId: TEST_SUBMISSION_ID_1,
          afterSubmissionId: TEST_SUBMISSION_ID_2,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Invalid afterSubmissionId.' }));
  });

  it('should propagate error if leaderboard not found', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      ReorderLiveQueueOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should propagate error if reorder fails', async () => {
    const error = new InternalFailureError({ message: 'DynamoDB error' });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([PENDING_ITEM_1]);
    vi.spyOn(liveQueueItemDao, 'reorder').mockRejectedValue(error);

    await expect(
      ReorderLiveQueueOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(error);
  });

  it('should allow reorder when race is SCHEDULED', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.SCHEDULED,
    });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([PENDING_ITEM_1, PENDING_ITEM_2]);
    vi.spyOn(liveQueueItemDao, 'reorder').mockResolvedValue({ ...PENDING_ITEM_1, queuePosition: 'a2' });

    const result = await ReorderLiveQueueOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result.item.submissionId).toBe(TEST_SUBMISSION_ID_1);
  });
});
