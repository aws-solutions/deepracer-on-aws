// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  LeaderboardItem,
  rankingDao,
  submissionDao,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ITEM,
} from '@deepracer-indy/database';
import { BadRequestError, InternalFailureError } from '@deepracer-indy/typescript-server-client';
import type { MockInstance } from 'vitest';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeleteLeaderboardOperation } from '../deleteLeaderboard.js';

describe('DeleteLeaderboard operation', () => {
  const CLOSED_LEADERBOARD: LeaderboardItem = {
    ...TEST_LEADERBOARD_ITEM,
    openTime: new Date(Date.now() - 90400000).toISOString(),
    closeTime: new Date(Date.now() - 86400000).toISOString(),
  };

  let deleteLeaderboardSpy: MockInstance<(typeof leaderboardDao)['delete']>;
  let deleteRankingsSpy: MockInstance<(typeof rankingDao)['deleteByLeaderboardId']>;
  let deleteSubmissionsSpy: MockInstance<(typeof submissionDao)['deleteByLeaderboardId']>;
  let loadLeaderboardSpy: MockInstance<(typeof leaderboardDao)['load']>;

  beforeEach(() => {
    deleteLeaderboardSpy = vi.spyOn(leaderboardDao, 'delete');
    deleteRankingsSpy = vi.spyOn(rankingDao, 'deleteByLeaderboardId');
    deleteSubmissionsSpy = vi.spyOn(submissionDao, 'deleteByLeaderboardId');
    loadLeaderboardSpy = vi.spyOn(leaderboardDao, 'load');
  });

  it('should successfully delete leaderboard', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteSubmissionsSpy.mockResolvedValueOnce();
    deleteRankingsSpy.mockResolvedValueOnce();
    deleteLeaderboardSpy.mockResolvedValue({
      leaderboardId: CLOSED_LEADERBOARD.leaderboardId,
    });

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT);

    expect(loadLeaderboardSpy).toHaveBeenCalledTimes(1);
    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
    expect(deleteSubmissionsSpy).toHaveBeenCalledTimes(1);
    expect(deleteRankingsSpy).toHaveBeenCalledTimes(1);
  });

  it('should not delete submissions or rankings if the leaderboard opens in the future', async () => {
    loadLeaderboardSpy.mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() + 86400000).toISOString(),
      closeTime: new Date(Date.now() + 96400000).toISOString(),
    });
    deleteLeaderboardSpy.mockResolvedValueOnce(TEST_LEADERBOARD_ITEM);

    await DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT);

    expect(loadLeaderboardSpy).toHaveBeenCalledTimes(1);
    expect(deleteLeaderboardSpy).toHaveBeenCalledTimes(1);
    expect(deleteSubmissionsSpy).not.toHaveBeenCalled();
    expect(deleteRankingsSpy).not.toHaveBeenCalled();
  });

  it('should throw error if leaderboard item does not exist', async () => {
    loadLeaderboardSpy.mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);

    expect(deleteSubmissionsSpy).not.toHaveBeenCalled();
    expect(deleteRankingsSpy).not.toHaveBeenCalled();
    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should throw error if leaderboard is in OPEN state', async () => {
    loadLeaderboardSpy.mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      openTime: new Date(Date.now() - 86400000).toISOString(),
      closeTime: new Date(Date.now() + 86400000).toISOString(),
    });

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Unable to delete an open leaderboard.' }));

    expect(deleteSubmissionsSpy).not.toHaveBeenCalled();
    expect(deleteRankingsSpy).not.toHaveBeenCalled();
    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should throw error if deleting leaderboard item fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteRankingsSpy.mockResolvedValueOnce();
    deleteSubmissionsSpy.mockResolvedValueOnce();
    deleteLeaderboardSpy.mockRejectedValue(new InternalFailureError({ message: 'Internal failure.' }));

    return expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Internal failure.' }));
  });

  it('should throw error if deleting submissions fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteSubmissionsSpy.mockRejectedValueOnce(new InternalFailureError({ message: 'Internal failure.' }));
    deleteRankingsSpy.mockResolvedValueOnce();

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Internal failure.' }));

    expect(deleteRankingsSpy).not.toHaveBeenCalled();
    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });

  it('should throw error if deleting rankings fails', async () => {
    loadLeaderboardSpy.mockResolvedValue(CLOSED_LEADERBOARD);
    deleteSubmissionsSpy.mockResolvedValueOnce();
    deleteRankingsSpy.mockRejectedValueOnce(new InternalFailureError({ message: 'Internal failure.' }));

    await expect(
      DeleteLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Internal failure.' }));

    expect(deleteLeaderboardSpy).not.toHaveBeenCalled();
  });
});
