// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  rankingDao,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_RANKING_ITEMS,
} from '@deepracer-indy/database';
import { BadRequestError, CombinedScoringStrategy } from '@deepracer-indy/typescript-server-client';
import base64url from 'base64url';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetCombinedLeaderboardOperation } from '../getCombinedLeaderboard.js';

const EVENT_WITH_STRATEGY = {
  ...TEST_EVENT_ITEM,
  combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER,
};

const TEST_INPUT = { eventId: TEST_EVENT_ID };

describe('GetCombinedLeaderboard operation', () => {
  it('returns rankings ordered by rank with combinedScoringStrategy', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(EVENT_WITH_STRATEGY);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: TEST_RANKING_ITEMS, cursor: null });

    const result = await GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(result.combinedScoringStrategy).toBe(CombinedScoringStrategy.BEST_RESULT_PER_RACER);
    expect(result.token).toBeUndefined();
    expect(result.rankings).toHaveLength(TEST_RANKING_ITEMS.length);
    result.rankings.forEach((ranking, index) => {
      const item = TEST_RANKING_ITEMS[index];
      expect(ranking).toEqual({
        rank: index + 1,
        rankingScore: item.rankingScore,
        stats: item.stats,
        submissionNumber: item.submissionNumber,
        submittedAt: new Date(item.createdAt),
        userProfile: item.userProfile,
        videoUrl: '',
      });
    });
  });

  it('sentinels videoUrl since combined leaderboards are physical-only and have no submission video', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(EVENT_WITH_STRATEGY);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: TEST_RANKING_ITEMS, cursor: null });

    const result = await GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(result.rankings.every((ranking) => ranking.videoUrl === '')).toBe(true);
  });

  it('queries rankingDao using eventId as the leaderboardId', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(EVENT_WITH_STRATEGY);
    const listByRankSpy = vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    await GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(listByRankSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_EVENT_ID,
      cursor: null,
      maxResults: undefined,
    });
  });

  it('forwards maxResults to rankingDao so clients can control page size', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(EVENT_WITH_STRATEGY);
    const listByRankSpy = vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    await GetCombinedLeaderboardOperation({ ...TEST_INPUT, maxResults: 25 }, TEST_OPERATION_CONTEXT);

    expect(listByRankSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_EVENT_ID,
      cursor: null,
      maxResults: 25,
    });
  });

  it('returns an empty rankings list when no combined rankings exist', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(EVENT_WITH_STRATEGY);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    const result = await GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(result.rankings).toHaveLength(0);
  });

  it('round-trips an ElectroDB-shaped cursor across pages without corrupting it', async () => {
    // GetCombinedLeaderboard has no fixed upper bound on racer count (a multi-track event's
    // combined leaderboard can exceed a single page), so per the AWS API Standards Pagination /
    // Unbounded Operations rules it must expose and honor a continuation token rather than
    // silently truncating or requiring an unbounded single-page read.
    //
    // rankingDao.listByRank calls ElectroDB's `.go({ cursor })` directly with no DAO-level cursor
    // encoding of its own, so its returned `cursor` IS ElectroDB's real wire format:
    // base64url(JSON.stringify(<raw composite LastEvaluatedKey>)) (see electrodb's default
    // `cursorFormatter.serialize`). This test uses that exact shape — a composite key resembling
    // RankingsEntity's sortedByRank LSI pager, not an arbitrary string — to prove the handler's
    // decode -> wrap-in-{lastEvaluatedKey,itemsSeen} -> encode -> ... -> unwrap -> re-encode round
    // trip reproduces the identical inner key ElectroDB gave it, rather than corrupting it.
    const electroDbLastEvaluatedKey = {
      pk: `leaderboard_${TEST_EVENT_ID}`,
      sk: 'ranking_2000',
      rankingScore: 2000,
    };
    const electroDbCursor = base64url.encode(JSON.stringify(electroDbLastEvaluatedKey));

    vi.spyOn(eventDao, 'load').mockResolvedValue(EVENT_WITH_STRATEGY);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: TEST_RANKING_ITEMS, cursor: electroDbCursor });

    const firstPage = await GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);
    expect(firstPage.token).toBeDefined();
    expect(firstPage.rankings.map((r) => r.rank)).toEqual(TEST_RANKING_ITEMS.map((_, i) => i + 1));

    const secondPageListByRankSpy = vi
      .spyOn(rankingDao, 'listByRank')
      .mockResolvedValue({ data: TEST_RANKING_ITEMS, cursor: null });

    const secondPage = await GetCombinedLeaderboardOperation(
      { ...TEST_INPUT, token: firstPage.token },
      TEST_OPERATION_CONTEXT,
    );

    // The cursor handed back to the DAO on page two must be byte-for-byte what ElectroDB itself
    // produced on page one — proving the envelope wrap/unwrap didn't alter or misinterpret it.
    expect(secondPageListByRankSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_EVENT_ID,
      cursor: electroDbCursor,
      maxResults: undefined,
    });
    expect(secondPage.token).toBeUndefined();
    // Rank numbering continues from where the first page left off rather than restarting at 1.
    expect(secondPage.rankings.map((r) => r.rank)).toEqual(
      TEST_RANKING_ITEMS.map((_, i) => TEST_RANKING_ITEMS.length + i + 1),
    );
  });

  it('throws BadRequestError when the event has no combinedScoringStrategy configured', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, combinedScoringStrategy: undefined });
    const listByRankSpy = vi.spyOn(rankingDao, 'listByRank');

    await expect(GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(listByRankSpy).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(GetCombinedLeaderboardOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
  });
});
