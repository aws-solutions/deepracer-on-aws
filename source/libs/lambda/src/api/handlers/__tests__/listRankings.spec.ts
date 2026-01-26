// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { rankingDao, leaderboardDao, TEST_LEADERBOARD_ITEM, TEST_RANKING_ITEMS } from '@deepracer-indy/database';
import { NotFoundError } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListRankingsOperation } from '../listRankings.js';

describe('ListRankings operation', () => {
  beforeEach(() => {
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));
  });

  it('should return rankings when available', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LEADERBOARD_ITEM);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: TEST_RANKING_ITEMS, cursor: null });

    const mockRankingContext = { itemsSeen: 4 };

    const result = await ListRankingsOperation(
      {
        leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
        token: Buffer.from(JSON.stringify(mockRankingContext)).toString('base64url'),
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(leaderboardDao.load).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
    expect(rankingDao.listByRank).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
      cursor: null,
    });
    expect(result.rankings).toHaveLength(TEST_RANKING_ITEMS.length);
    expect(result.token).toBeUndefined();
    result.rankings.forEach((ranking, index) => {
      expect(ranking).toEqual({
        submittedAt: new Date(TEST_RANKING_ITEMS[index].createdAt),
        stats: TEST_RANKING_ITEMS[index].stats,
        submissionNumber: TEST_RANKING_ITEMS[index].submissionNumber,
        userProfile: TEST_RANKING_ITEMS[index].userProfile,
        rankingScore: TEST_RANKING_ITEMS[index].rankingScore,
        rank: (mockRankingContext.itemsSeen += 1),
        videoUrl: TEST_RANKING_ITEMS[index].submissionVideoS3Location,
      });
    });
  });

  it('should throw an error when leaderboard is not found', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(new NotFoundError({ message: 'Leaderboard not found.' }));

    await expect(
      ListRankingsOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('Leaderboard not found');
  });
});
