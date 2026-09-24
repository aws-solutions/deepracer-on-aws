// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, leaderboardDao, rankingDao, type RankingItem, type ResourceId } from '@deepracer-indy/database';
import { CombinedScoringStrategy } from '@deepracer-indy/typescript-server-client';
import { metrics } from '@deepracer-indy/utils';

import { computeCombinedScore, recomputeCombinedLeaderboard } from '../combinedLeaderboard.js';

vi.mock('@deepracer-indy/database', () => ({
  eventDao: { get: vi.fn() },
  leaderboardDao: { listByEventId: vi.fn() },
  rankingDao: { get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('@deepracer-indy/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/utils')>();
  return {
    ...actual,
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    metrics: { addMetric: vi.fn() },
  };
});

const mockEventDao = vi.mocked(eventDao);
const mockLeaderboardDao = vi.mocked(leaderboardDao);
const mockRankingDao = vi.mocked(rankingDao);
const mockMetrics = vi.mocked(metrics);

const EVENT_ID = 'evt-1' as ResourceId;
const PROFILE_ID = 'profile-1' as ResourceId;
const TRACK_A = 'track-a' as ResourceId;
const TRACK_B = 'track-b' as ResourceId;
const TRACK_C = 'track-c' as ResourceId;

const rankingFixture = (leaderboardId: ResourceId, rankingScore: number, modelName = 'SpeedBot'): RankingItem =>
  ({
    leaderboardId,
    profileId: PROFILE_ID,
    rankingScore,
    modelId: 'model-1',
    modelName,
    submissionId: 'sub-1',
    submissionNumber: 1,
    submissionVideoS3Location: 's3://bucket/video.mp4',
    userProfile: { alias: 'Alice', avatar: {} },
    stats: {
      avgLapTime: 0,
      avgResets: 0,
      bestLapTime: rankingScore,
      collisionCount: 0,
      completedLapCount: 1,
      offTrackCount: 0,
      resetCount: 0,
      totalLapTime: rankingScore,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as unknown as RankingItem;

describe('computeCombinedScore', () => {
  it('takes the min score for BEST_RESULT_PER_RACER', () => {
    const scores = new Map([
      [TRACK_A, rankingFixture(TRACK_A, 12000)],
      [TRACK_B, rankingFixture(TRACK_B, 9000)],
    ]);
    expect(computeCombinedScore(CombinedScoringStrategy.BEST_RESULT_PER_RACER, scores)).toBe(9000);
  });

  it('takes the min score across tracks when the racer has raced only some tracks', () => {
    // Multi-track events commonly run tracks concurrently as independent heats; a racer
    // need not have raced every track for BEST_RESULT_PER_RACER to apply.
    const scores = new Map([[TRACK_A, rankingFixture(TRACK_A, 15000)]]);
    expect(computeCombinedScore(CombinedScoringStrategy.BEST_RESULT_PER_RACER, scores)).toBe(15000);
  });

  it('sums whatever per-track scores the racer currently has for SUM_ACROSS_TRACKS', () => {
    const scores = new Map([
      [TRACK_A, rankingFixture(TRACK_A, 10000)],
      [TRACK_B, rankingFixture(TRACK_B, 12000)],
    ]);
    expect(computeCombinedScore(CombinedScoringStrategy.SUM_ACROSS_TRACKS, scores)).toBe(22000);
  });

  it('sums a single track score for SUM_ACROSS_TRACKS when the racer has raced only one track', () => {
    // PRD US-3.2.1: tracks run concurrently as independent heats ("qualifying and finals with
    // unified standings") — the combined leaderboard reflects real-time partial progress, it
    // does not wait until every racer has raced every track.
    const scores = new Map([[TRACK_A, rankingFixture(TRACK_A, 10000)]]);
    expect(computeCombinedScore(CombinedScoringStrategy.SUM_ACROSS_TRACKS, scores)).toBe(10000);
  });

  it('averages whatever per-track scores the racer currently has for AVERAGE_ACROSS_TRACKS', () => {
    const scores = new Map([
      [TRACK_A, rankingFixture(TRACK_A, 10000)],
      [TRACK_B, rankingFixture(TRACK_B, 12000)],
      [TRACK_C, rankingFixture(TRACK_C, 14000)],
    ]);
    expect(computeCombinedScore(CombinedScoringStrategy.AVERAGE_ACROSS_TRACKS, scores)).toBe(12000);
  });

  it('averages a single track score for AVERAGE_ACROSS_TRACKS when the racer has raced only one track', () => {
    const scores = new Map([[TRACK_A, rankingFixture(TRACK_A, 10000)]]);
    expect(computeCombinedScore(CombinedScoringStrategy.AVERAGE_ACROSS_TRACKS, scores)).toBe(10000);
  });

  it('returns undefined when the racer has no scores on any track', () => {
    expect(computeCombinedScore(CombinedScoringStrategy.BEST_RESULT_PER_RACER, new Map())).toBeUndefined();
  });

  it('throws for an unrecognized strategy instead of returning undefined (would otherwise be indistinguishable from "no scores" and trigger an incorrect delete)', () => {
    const scores = new Map([[TRACK_A, rankingFixture(TRACK_A, 10000)]]);
    expect(() => computeCombinedScore('UNKNOWN_STRATEGY' as CombinedScoringStrategy, scores)).toThrow(
      'Unsupported combined scoring strategy: UNKNOWN_STRATEGY',
    );
  });
});

describe('recomputeCombinedLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits when the event has no combinedScoringStrategy', async () => {
    mockEventDao.get.mockResolvedValue({ eventId: EVENT_ID } as never);

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    expect(mockLeaderboardDao.listByEventId).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('short-circuits when the event does not exist', async () => {
    mockEventDao.get.mockResolvedValue(undefined as never);

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    expect(mockLeaderboardDao.listByEventId).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('short-circuits when the event has no tracks', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({ data: [], cursor: null } as never);

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    expect(mockRankingDao.get).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('creates a new combined Ranking when none exists yet', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }, { leaderboardId: TRACK_B }],
      cursor: null,
    } as never);
    mockRankingDao.get
      .mockResolvedValueOnce(rankingFixture(TRACK_A, 12000, 'SlowBot') as never) // TRACK_A ranking (worse score)
      .mockResolvedValueOnce(rankingFixture(TRACK_B, 9000, 'FastBot') as never) // TRACK_B ranking (winning score)
      .mockResolvedValueOnce(undefined as never); // no existing combined ranking

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    // Display metadata must come from the winning (TRACK_B) Ranking, not the first one queried.
    expect(mockRankingDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        leaderboardId: EVENT_ID,
        profileId: PROFILE_ID,
        rankingScore: 9000,
        modelName: 'FastBot',
      }),
    );
    expect(mockRankingDao.update).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('updates an existing combined Ranking', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.SUM_ACROSS_TRACKS,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }, { leaderboardId: TRACK_B }],
      cursor: null,
    } as never);
    mockRankingDao.get
      .mockResolvedValueOnce(rankingFixture(TRACK_A, 10000) as never)
      .mockResolvedValueOnce(rankingFixture(TRACK_B, 11000) as never)
      .mockResolvedValueOnce(rankingFixture(EVENT_ID, 30000) as never); // existing combined ranking

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    expect(mockRankingDao.update).toHaveBeenCalledWith(
      { leaderboardId: EVENT_ID, profileId: PROFILE_ID },
      expect.objectContaining({ rankingScore: 21000 }),
    );
    expect(mockRankingDao.create).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('sources display metadata from the best-performing track for SUM_ACROSS_TRACKS (no single source track for an aggregate)', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.SUM_ACROSS_TRACKS,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }, { leaderboardId: TRACK_B }],
      cursor: null,
    } as never);
    mockRankingDao.get
      .mockResolvedValueOnce(rankingFixture(TRACK_A, 15000, 'SlowBot') as never)
      .mockResolvedValueOnce(rankingFixture(TRACK_B, 10000, 'FastBot') as never)
      .mockResolvedValueOnce(undefined as never);

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    // rankingScore is the sum (25000) — not any single track's score — but the metadata is
    // sourced from the racer's best-performing track (TRACK_B, FastBot) for consistency.
    expect(mockRankingDao.create).toHaveBeenCalledWith(
      expect.objectContaining({ rankingScore: 25000, modelName: 'FastBot' }),
    );
  });

  it('deletes any stale combined Ranking when the racer has no per-track Ranking at all', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.SUM_ACROSS_TRACKS,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }, { leaderboardId: TRACK_B }],
      cursor: null,
    } as never);
    // Racer's only per-track Ranking was removed (e.g. lap edit invalidated their sole
    // submission) — they no longer have any score to combine, so any stale combined
    // Ranking from before must be cleared.
    mockRankingDao.get.mockResolvedValueOnce(undefined as never).mockResolvedValueOnce(undefined as never);

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    expect(mockRankingDao.delete).toHaveBeenCalledWith({ leaderboardId: EVENT_ID, profileId: PROFILE_ID });
    expect(mockRankingDao.create).not.toHaveBeenCalled();
    expect(mockRankingDao.update).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('never throws and emits CombinedLeaderboardRecomputeFailed on error', async () => {
    mockEventDao.get.mockRejectedValue(new Error('DDB unavailable'));

    await expect(recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID)).resolves.toBeUndefined();

    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputeFailed', 'Count', 1);
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('emits CombinedLeaderboardRecomputeFailed (never deletes) when the event has an unrecognized combinedScoringStrategy', async () => {
    // An unrecognized/future enum value must hit the error boundary, not be treated as "no
    // scores" — otherwise it would silently delete a racer's valid combined Ranking.
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: 'UNKNOWN_STRATEGY',
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }],
      cursor: null,
    } as never);
    mockRankingDao.get.mockResolvedValueOnce(rankingFixture(TRACK_A, 10000) as never);

    await expect(recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID)).resolves.toBeUndefined();

    expect(mockRankingDao.delete).not.toHaveBeenCalled();
    expect(mockRankingDao.create).not.toHaveBeenCalled();
    expect(mockRankingDao.update).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputeFailed', 'Count', 1);
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('emits CombinedLeaderboardRecomputeFailed when the ranking upsert fails', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }],
      cursor: null,
    } as never);
    mockRankingDao.get
      .mockResolvedValueOnce(rankingFixture(TRACK_A, 10000) as never)
      .mockResolvedValueOnce(undefined as never);
    mockRankingDao.create.mockRejectedValue(new Error('conditional check failed'));

    await expect(recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID)).resolves.toBeUndefined();

    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputeFailed', 'Count', 1);
  });

  it('creates a combined Ranking for a racer who has raced only one of several concurrent tracks', async () => {
    // PRD US-3.2.1: an event can run multiple tracks concurrently as independent heats
    // (e.g. qualifying on Track A and Track B running simultaneously, feeding one combined
    // leaderboard). A racer who has only raced Track A must still appear on the combined
    // leaderboard with a real-time SUM/AVERAGE score — they are not required to have raced
    // every track in the event first.
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.SUM_ACROSS_TRACKS,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }, { leaderboardId: TRACK_B }, { leaderboardId: TRACK_C }],
      cursor: null,
    } as never);
    mockRankingDao.get
      .mockResolvedValueOnce(rankingFixture(TRACK_A, 10000) as never) // TRACK_A ranking
      .mockResolvedValueOnce(undefined as never) // no TRACK_B ranking yet
      .mockResolvedValueOnce(undefined as never) // no TRACK_C ranking yet
      .mockResolvedValueOnce(undefined as never); // no existing combined ranking

    await recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID);

    expect(mockRankingDao.create).toHaveBeenCalledWith(
      expect.objectContaining({ leaderboardId: EVENT_ID, profileId: PROFILE_ID, rankingScore: 10000 }),
    );
    expect(mockRankingDao.delete).not.toHaveBeenCalled();
    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputed', 'Count', 1);
  });

  it('emits CombinedLeaderboardRecomputeFailed when clearing a stale combined Ranking fails', async () => {
    mockEventDao.get.mockResolvedValue({
      eventId: EVENT_ID,
      combinedScoringStrategy: CombinedScoringStrategy.SUM_ACROSS_TRACKS,
    } as never);
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: TRACK_A }, { leaderboardId: TRACK_B }],
      cursor: null,
    } as never);
    mockRankingDao.get.mockResolvedValueOnce(undefined as never).mockResolvedValueOnce(undefined as never);
    mockRankingDao.delete.mockRejectedValue(new Error('DDB unavailable'));

    await expect(recomputeCombinedLeaderboard(EVENT_ID, PROFILE_ID)).resolves.toBeUndefined();

    expect(mockMetrics.addMetric).toHaveBeenCalledWith('CombinedLeaderboardRecomputeFailed', 'Count', 1);
  });
});
