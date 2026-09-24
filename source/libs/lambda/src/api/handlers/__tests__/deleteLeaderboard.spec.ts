// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  modelDao,
  rankingDao,
  submissionDao,
  type LeaderboardItem,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_LIVE_QUEUE_ITEMS,
  TEST_MODEL_ID_1,
  TEST_PROFILE_ID_1,
  TEST_PROFILE_ID_2,
  TEST_PROFILE_ID_3,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  LiveEventStatus,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';
import type { MockInstance } from 'vitest';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import * as apiGatewayUtils from '../../utils/apiGateway.js';
import { DeleteLeaderboardOperation } from '../deleteLeaderboard.js';

describe('DeleteLeaderboard operation', () => {
  const CLOSED_LEADERBOARD: LeaderboardItem = {
    ...TEST_LEADERBOARD_ITEM,
    openTime: new Date(Date.now() - 90400000).toISOString(),
    closeTime: new Date(Date.now() - 86400000).toISOString(),
  };

  const LIVE_LEADERBOARD_SCHEDULED: LeaderboardItem = {
    ...CLOSED_LEADERBOARD,
    isLive: true,
    liveEventStatus: LiveEventStatus.SCHEDULED,
  };

  const LIVE_LEADERBOARD_IN_PROGRESS: LeaderboardItem = {
    ...CLOSED_LEADERBOARD,
    isLive: true,
    liveEventStatus: LiveEventStatus.IN_PROGRESS,
  };

  const LIVE_LEADERBOARD_COMPLETED: LeaderboardItem = {
    ...CLOSED_LEADERBOARD,
    isLive: true,
    liveEventStatus: LiveEventStatus.COMPLETED,
    winnerId: 'winner-profile-id' as never,
  };

  let deleteLeaderboardSpy: MockInstance<(typeof leaderboardDao)['delete']>;
  let deleteRankingsSpy: MockInstance<(typeof rankingDao)['deleteByLeaderboardId']>;
  let deleteSubmissionsSpy: MockInstance<(typeof submissionDao)['deleteByLeaderboardId']>;
  let loadLeaderboardSpy: MockInstance<(typeof leaderboardDao)['load']>;
  let deleteQueueItemsSpy: MockInstance<(typeof liveQueueItemDao)['deleteByLeaderboardId']>;

  beforeEach(() => {
    deleteLeaderboardSpy = vi.spyOn(leaderboardDao, 'delete').mockResolvedValue({ leaderboardId: TEST_LEADERBOARD_ID });
    deleteRankingsSpy = vi.spyOn(rankingDao, 'deleteByLeaderboardId').mockResolvedValue([]);
    deleteSubmissionsSpy = vi.spyOn(submissionDao, 'deleteByLeaderboardId').mockResolvedValue([]);
    loadLeaderboardSpy = vi.spyOn(leaderboardDao, 'load');
    deleteQueueItemsSpy = vi.spyOn(liveQueueItemDao, 'deleteByLeaderboardId').mockResolvedValue(undefined);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(modelDao, 'update').mockResolvedValue(undefined as never);
    // Default to non-admin so existing tests that test open-state rejection still pass
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(false);
  });

  it('should successfully delete a closed community leaderboard', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteSubmissionsSpy).toHaveBeenCalledTimes(1);
    expect(deleteRankingsSpy).toHaveBeenCalledTimes(1);
    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
    expect(deleteQueueItemsSpy).not.toHaveBeenCalled();
  });

  it('should not delete submissions or rankings if the leaderboard opens in the future', async () => {
    loadLeaderboardSpy.mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() + 86400000).toISOString(),
      closeTime: new Date(Date.now() + 96400000).toISOString(),
    });

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
    expect(deleteSubmissionsSpy).not.toHaveBeenCalled();
    expect(deleteRankingsSpy).not.toHaveBeenCalled();
  });

  it('should throw error if leaderboard item does not exist', async () => {
    loadLeaderboardSpy.mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);

    expect(deleteSubmissionsSpy).not.toHaveBeenCalled();
    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should throw error if leaderboard is in OPEN state', async () => {
    loadLeaderboardSpy.mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() - 86400000).toISOString(),
      closeTime: new Date(Date.now() + 86400000).toISOString(),
    });

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Unable to delete an open leaderboard.' }));

    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should throw error if deleting leaderboard item fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteLeaderboardSpy.mockRejectedValue(new InternalFailureError({ message: 'Internal failure.' }));

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Internal failure.' }));
  });

  it('should throw error if deleting submissions fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteSubmissionsSpy.mockRejectedValueOnce(new InternalFailureError({ message: 'Internal failure.' }));

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Internal failure.' }));

    expect(deleteRankingsSpy).not.toHaveBeenCalled();
    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should throw error if deleting rankings fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteRankingsSpy.mockRejectedValueOnce(new InternalFailureError({ message: 'Internal failure.' }));

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Internal failure.' }));

    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  // Live race tests

  it('should allow delete of SCHEDULED live leaderboard', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_SCHEDULED);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteQueueItemsSpy).toHaveBeenCalledWith(TEST_LEADERBOARD_ID);
    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });

  it('should allow delete of SCHEDULED live leaderboard even when within its open/close window', async () => {
    // Live races are governed by liveEventStatus, not the open/close window.
    // A SCHEDULED live race within its time window must still be deletable.
    loadLeaderboardSpy.mockResolvedValue({
      ...LIVE_LEADERBOARD_SCHEDULED,
      openTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
      closeTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7d from now
    });

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });

  it('should block delete of IN_PROGRESS live leaderboard with no winner', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_IN_PROGRESS);

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Declare a winner first.' }));

    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should allow delete of COMPLETED live leaderboard with winner declared', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_COMPLETED);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteQueueItemsSpy).toHaveBeenCalledWith(TEST_LEADERBOARD_ID);
    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });

  it('should reset QUEUED models to READY on live leaderboard delete', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_SCHEDULED);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue(TEST_LIVE_QUEUE_ITEMS);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(modelDao.update).toHaveBeenCalledTimes(3);
    expect(modelDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: TEST_PROFILE_ID_1, modelId: TEST_MODEL_ID_1 }),
      { status: ModelStatus.READY },
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: TEST_PROFILE_ID_2, modelId: TEST_MODEL_ID_1 }),
      { status: ModelStatus.READY },
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: TEST_PROFILE_ID_3, modelId: TEST_MODEL_ID_1 }),
      { status: ModelStatus.READY },
    );
  });

  it('should delete live queue items on live leaderboard delete', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_SCHEDULED);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([TEST_LIVE_QUEUE_ITEM]);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteQueueItemsSpy).toHaveBeenCalledWith(TEST_LEADERBOARD_ID);
  });

  it('should still delete leaderboard if model reset fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_SCHEDULED);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([TEST_LIVE_QUEUE_ITEM]);
    vi.spyOn(modelDao, 'update').mockRejectedValue(new Error('DynamoDB error'));

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });

  it('should still delete leaderboard if getQueue fails during model reset', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_SCHEDULED);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockRejectedValue(new Error('DynamoDB error'));

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });

  it('should skip model reset for queue items without modelId', async () => {
    loadLeaderboardSpy.mockResolvedValue(LIVE_LEADERBOARD_SCHEDULED);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([
      { ...TEST_LIVE_QUEUE_ITEM, modelId: undefined as never },
    ]);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(modelDao.update).not.toHaveBeenCalled();
    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteLeaderboard — active community race', () => {
  const ACTIVE_LEADERBOARD: LeaderboardItem = {
    ...TEST_LEADERBOARD_ITEM,
    openTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
    closeTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7d from now
    isLive: false,
  };

  let deleteLeaderboardSpy: MockInstance<(typeof leaderboardDao)['delete']>;
  let deleteRankingsSpy: MockInstance<(typeof rankingDao)['deleteByLeaderboardId']>;
  let deleteSubmissionsSpy: MockInstance<(typeof submissionDao)['deleteByLeaderboardId']>;

  beforeEach(() => {
    deleteLeaderboardSpy = vi.spyOn(leaderboardDao, 'delete').mockResolvedValue({ leaderboardId: TEST_LEADERBOARD_ID });
    deleteRankingsSpy = vi.spyOn(rankingDao, 'deleteByLeaderboardId').mockResolvedValue([]);
    deleteSubmissionsSpy = vi.spyOn(submissionDao, 'deleteByLeaderboardId').mockResolvedValue([]);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(ACTIVE_LEADERBOARD);
  });

  it('should allow admin to delete an active community race', async () => {
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(true);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
  });

  it('should NOT delete submissions or rankings for admin delete of active race (non-destructive)', async () => {
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(true);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(deleteSubmissionsSpy).not.toHaveBeenCalled();
    expect(deleteRankingsSpy).not.toHaveBeenCalled();
  });

  it('should reject non-admin attempting to delete an active community race', async () => {
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(false);

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Unable to delete an open leaderboard.' }));
  });

  it('should not call leaderboard.delete when non-admin tries active race delete', async () => {
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(false);

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow();

    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });
});
