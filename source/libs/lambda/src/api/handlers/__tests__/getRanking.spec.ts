// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { rankingDao, TEST_RANKING_ITEM } from '@deepracer-indy/database';
import { s3Helper } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetRankingOperation } from '../getRanking.js';

describe('GetRanking operation', () => {
  it('should return ranking', async () => {
    const personalRanking = { ...TEST_RANKING_ITEM, rank: 1 };

    vi.spyOn(rankingDao, 'getWithRank').mockResolvedValueOnce(personalRanking);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));

    const result = await GetRankingOperation({ leaderboardId: personalRanking.leaderboardId }, TEST_OPERATION_CONTEXT);

    expect(result.ranking).toEqual({
      modelId: personalRanking.modelId,
      modelName: personalRanking.modelName,
      rank: personalRanking.rank,
      rankingScore: personalRanking.rankingScore,
      stats: personalRanking.stats,
      submissionNumber: personalRanking.submissionNumber,
      submittedAt: new Date(personalRanking.createdAt),
      videoUrl: personalRanking.submissionVideoS3Location,
    });
  });

  it('should return empty object if ranking does not exist', async () => {
    vi.spyOn(rankingDao, 'getWithRank').mockResolvedValueOnce(null);

    const result = await GetRankingOperation(
      { leaderboardId: TEST_RANKING_ITEM.leaderboardId },
      TEST_OPERATION_CONTEXT,
    );

    expect(result).toStrictEqual({});
  });
});
