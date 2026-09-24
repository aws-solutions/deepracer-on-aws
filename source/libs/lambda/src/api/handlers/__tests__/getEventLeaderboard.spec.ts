// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, leaderboardDao, rankingDao } from '@deepracer-indy/database';
import { NotFoundError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetEventLeaderboardOperation } from '../getEventLeaderboard.js';

vi.mock('@deepracer-indy/database', () => ({
  eventDao: { load: vi.fn() },
  leaderboardDao: { get: vi.fn() },
  rankingDao: { listByRank: vi.fn() },
  TEST_PROFILE_ID_1: 'profile_test-profile-1',
}));

const mockLeaderboardDao = vi.mocked(leaderboardDao);
const mockRankingDao = vi.mocked(rankingDao);

const INPUT = { eventId: 'evt-1', trackId: 'lb-1' };

describe('GetEventLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeaderboardDao.get.mockResolvedValue({ leaderboardId: 'lb-1', isLive: true } as never);
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);
  });

  it('returns an empty rankings list when no entries exist', async () => {
    const result = await GetEventLeaderboardOperation(INPUT, TEST_OPERATION_CONTEXT);
    expect(result.rankings).toHaveLength(0);
  });

  it('returns ranked entries in order with correct fields', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { rankingScore: 10000, userProfile: { alias: 'Alice' }, modelName: 'SpeedBot' },
        { rankingScore: 11000, userProfile: { alias: 'Bob' }, modelName: 'FastBot' },
      ],
      cursor: null,
    } as never);

    const result = await GetEventLeaderboardOperation(INPUT, TEST_OPERATION_CONTEXT);
    expect(result.rankings).toHaveLength(2);
    expect(result.rankings[0]).toMatchObject({
      rank: 1,
      participantName: 'Alice',
      bestLapTimeMilliseconds: 10000,
      modelName: 'SpeedBot',
    });
    expect(result.rankings[1]).toMatchObject({ rank: 2, participantName: 'Bob' });
  });

  it('queries rankingDao with trackId as leaderboardId and maxResults 50', async () => {
    await GetEventLeaderboardOperation(INPUT, TEST_OPERATION_CONTEXT);
    expect(mockRankingDao.listByRank).toHaveBeenCalledWith({ leaderboardId: 'lb-1', maxResults: 50 });
  });

  it('throws NotFoundError when the leaderboard does not exist', async () => {
    mockLeaderboardDao.get.mockResolvedValue(undefined as never);

    await expect(GetEventLeaderboardOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotFoundError({ message: 'Track not found.' }),
    );
    expect(mockRankingDao.listByRank).not.toHaveBeenCalled();
  });

  it('throws when the track belongs to a DELETING event', async () => {
    const hiddenEventError = new NotFoundError({ message: 'Event not found.' });
    mockLeaderboardDao.get.mockResolvedValue({ leaderboardId: 'lb-1', eventId: 'evt-1' } as never);
    vi.mocked(eventDao.load).mockRejectedValue(hiddenEventError);

    await expect(GetEventLeaderboardOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(hiddenEventError);
    expect(mockRankingDao.listByRank).not.toHaveBeenCalled();
  });

  it('handles missing userProfile and modelName gracefully', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [{ rankingScore: 9000, userProfile: null, modelName: null }],
      cursor: null,
    } as never);

    const result = await GetEventLeaderboardOperation(INPUT, TEST_OPERATION_CONTEXT);
    expect(result.rankings[0]).toMatchObject({
      rank: 1,
      participantName: '',
      bestLapTimeMilliseconds: 9000,
      modelName: '',
    });
  });
});
