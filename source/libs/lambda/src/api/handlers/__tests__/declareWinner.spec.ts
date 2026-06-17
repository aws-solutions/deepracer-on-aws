// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  modelDao,
  rankingDao,
  type LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_RANKING_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_SUBMISSION_ID_2,
  TEST_SUBMISSION_ID_3,
  TEST_MODEL_ID_2,
  TEST_PROFILE_ID_2,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  LiveEventStatus,
  LiveQueueItemStatus,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeclareWinnerOperation } from '../declareWinner.js';

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  currentExecutionArn: '',
};

describe('DeclareWinner', () => {
  it('should declare winner successfully', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockResolvedValue(undefined);

    const result = await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winnerId).toBe(TEST_RANKING_ITEM.submissionId);
    expect(result.liveEventStatus).toBe(LiveEventStatus.COMPLETED);
    expect(result.pendingCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.winnerDeclaredAt).toBeInstanceOf(Date);
    expect(leaderboardDao.declareWinner).toHaveBeenCalledWith(
      TEST_LEADERBOARD_ID,
      expect.objectContaining({ winnerId: TEST_RANKING_ITEM.submissionId }),
    );
  });

  it('should return pending and failed counts', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.PENDING },
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.PENDING },
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.FAILED },
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.COMPLETED },
    ]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockResolvedValue(undefined);

    const result = await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.pendingCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  it('should allow declaring winner with no rankings', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockResolvedValue(undefined);

    const result = await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winnerId).toBeUndefined();
    expect(result.liveEventStatus).toBe(LiveEventStatus.COMPLETED);
  });

  it('should throw BadRequestError if not a live race', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Not a live race.' }));
  });

  it('should throw BadRequestError if race has not started', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.SCHEDULED,
    });

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Race has not started yet.' }));
  });

  it('should return existing winner data if winner has already been declared (idempotent)', async () => {
    const completedLeaderboard = {
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
      winnerId: TEST_RANKING_ITEM.submissionId,
      winnerDeclaredAt: '2026-04-14T10:00:00.000Z',
    };
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(completedLeaderboard);
    vi.spyOn(leaderboardDao, 'declareWinner').mockResolvedValue(undefined);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.PENDING },
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.FAILED },
    ]);

    const result = await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winnerId).toBe(TEST_RANKING_ITEM.submissionId);
    expect(result.liveEventStatus).toBe(LiveEventStatus.COMPLETED);
    expect(result.winnerDeclaredAt).toEqual(new Date('2026-04-14T10:00:00.000Z'));
    expect(result.pendingCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(leaderboardDao.declareWinner).not.toHaveBeenCalled();
  });

  it('should throw ConflictError if execution is currently running', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: 'arn:aws:states:us-east-1:123:execution:running',
    });

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Cannot declare winner while evaluation is running.' }));
  });

  it('should throw NotFoundError if leaderboard does not exist', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should return existing winner data if ConditionalCheckFailedException and race is COMPLETED', async () => {
    const condError = new Error('The conditional request failed');
    condError.name = 'ConditionalCheckFailedException';
    const completedLeaderboard = {
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
      winnerId: TEST_RANKING_ITEM.submissionId,
      winnerDeclaredAt: '2026-04-14T10:00:00.000Z',
    };
    vi.spyOn(leaderboardDao, 'load')
      .mockResolvedValueOnce(TEST_LIVE_LEADERBOARD)
      .mockResolvedValueOnce(completedLeaderboard);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.FAILED }]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockRejectedValue(condError);

    const result = await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winnerId).toBe(TEST_RANKING_ITEM.submissionId);
    expect(result.liveEventStatus).toBe(LiveEventStatus.COMPLETED);
    expect(result.pendingCount).toBe(0);
    expect(result.failedCount).toBe(1);
  });

  it('should throw ConflictError if ConditionalCheckFailedException and race is not COMPLETED', async () => {
    const condError = new Error('The conditional request failed');
    condError.name = 'ConditionalCheckFailedException';
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockRejectedValue(condError);

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Race state changed. Please retry.' }));
  });

  it('should throw ConflictError if declareWinner fails via err.cause.name and race not COMPLETED', async () => {
    const wrappedError = Object.assign(new Error('wrapped'), {
      cause: { name: 'ConditionalCheckFailedException' },
    });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockRejectedValue(wrappedError);

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Race state changed. Please retry.' }));
  });

  it('should throw ConflictError if declareWinner fails via message includes conditional and race not COMPLETED', async () => {
    const msgError = new Error('The conditional request failed');
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockRejectedValue(msgError);

    await expect(
      DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Race state changed. Please retry.' }));
  });

  it('should reset all models to READY status', async () => {
    const pendingItem = { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.PENDING };
    const failedItem = {
      ...TEST_LIVE_QUEUE_ITEM,
      submissionId: TEST_SUBMISSION_ID_2,
      profileId: TEST_PROFILE_ID_2,
      modelId: TEST_MODEL_ID_2,
      status: LiveQueueItemStatus.FAILED,
    };
    const completedItem = {
      ...TEST_LIVE_QUEUE_ITEM,
      submissionId: TEST_SUBMISSION_ID_3,
      status: LiveQueueItemStatus.COMPLETED,
    };

    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([pendingItem, failedItem, completedItem]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockResolvedValue(undefined as never);
    vi.spyOn(modelDao, 'update').mockResolvedValue(undefined as never);

    await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(modelDao.update).toHaveBeenCalledTimes(3);
    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: pendingItem.profileId, modelId: pendingItem.modelId },
      { status: ModelStatus.READY },
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: failedItem.profileId, modelId: failedItem.modelId },
      { status: ModelStatus.READY },
    );
    expect(modelDao.update).toHaveBeenCalledWith(
      { profileId: completedItem.profileId, modelId: completedItem.modelId },
      { status: ModelStatus.READY },
    );
  });

  it('should succeed even if model READY reset fails', async () => {
    const pendingItem = { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.PENDING };

    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEM], cursor: null });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([pendingItem]);
    vi.spyOn(leaderboardDao, 'declareWinner').mockResolvedValue(undefined as never);
    vi.spyOn(modelDao, 'update').mockRejectedValue(new Error('DynamoDB error'));

    const result = await DeclareWinnerOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.liveEventStatus).toBe(LiveEventStatus.COMPLETED);
  });
});
