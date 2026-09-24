// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  lapDao,
  submissionDao,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_LEADERBOARD_ID,
  TEST_PROFILE_ID_1,
  TEST_RUN_ID,
  TEST_SUBMISSION_ID_1,
} from '@deepracer-indy/database';
import { ConflictError, RaceFormat, RunStatus } from '@deepracer-indy/typescript-server-client';
import { vi } from 'vitest';

import {
  computeScoreFromLaps,
  recalculateScoreIfSubmitted,
  recalculateScoreIfSubmittedSafely,
} from '../recalculateScoreIfSubmitted.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    eventDao: { load: vi.fn() },
    lapDao: { listByRun: vi.fn() },
    submissionDao: { updateScoreWithRanking: vi.fn() },
  };
});

const mockEventDao = vi.mocked(eventDao);
const mockLapDao = vi.mocked(lapDao);
const mockSubmissionDao = vi.mocked(submissionDao);

const RUN = {
  leaderboardId: TEST_LEADERBOARD_ID,
  runId: TEST_RUN_ID,
  eventId: TEST_EVENT_ID,
  profileId: TEST_PROFILE_ID_1,
  runStatus: RunStatus.SUBMITTED,
  submissionId: TEST_SUBMISSION_ID_1,
};

describe('computeScoreFromLaps', () => {
  it('should return the minimum lap time for BEST_LAP format', () => {
    expect(computeScoreFromLaps([15000, 12000, 13500], RaceFormat.BEST_LAP)).toBe(12000);
  });

  it('should return the average lap time for AVERAGE_LAPS format', () => {
    expect(computeScoreFromLaps([10000, 20000, 30000], RaceFormat.AVERAGE_LAPS)).toBe(20000);
  });

  it('should return undefined when there are no laps', () => {
    expect(computeScoreFromLaps([], RaceFormat.BEST_LAP)).toBeUndefined();
  });

  it('should average only the most-recent N laps when averageLapsWindow is set', () => {
    // Lap times are ordered oldest-to-newest; window=2 should average just the last two (30000, 40000).
    expect(computeScoreFromLaps([10000, 20000, 30000, 40000], RaceFormat.AVERAGE_LAPS, 2)).toBe(35000);
  });

  it('should average all laps when averageLapsWindow exceeds the number of laps available', () => {
    expect(computeScoreFromLaps([10000, 20000], RaceFormat.AVERAGE_LAPS, 5)).toBe(15000);
  });

  it('should ignore averageLapsWindow for BEST_LAP format', () => {
    expect(computeScoreFromLaps([15000, 12000, 13500], RaceFormat.BEST_LAP, 1)).toBe(12000);
  });
});

describe('recalculateScoreIfSubmitted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined and do nothing when run is not SUBMITTED', async () => {
    const result = await recalculateScoreIfSubmitted({ ...RUN, runStatus: RunStatus.FINISHED });

    expect(result).toBeUndefined();
    expect(mockLapDao.listByRun).not.toHaveBeenCalled();
    expect(mockSubmissionDao.updateScoreWithRanking).not.toHaveBeenCalled();
  });

  it('should recompute BEST_LAP score, and atomically update the submission and ranking together', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      cursor: null,
      data: [
        { lapNumber: 1, lapTimeMs: 15000, isValid: true },
        { lapNumber: 2, lapTimeMs: 11000, isValid: true },
        { lapNumber: 3, lapTimeMs: 9000, isValid: false },
      ],
    } as never);
    mockEventDao.load.mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
    mockSubmissionDao.updateScoreWithRanking.mockResolvedValue(undefined);

    const result = await recalculateScoreIfSubmitted(RUN);

    expect(result).toBe(11000);
    expect(mockSubmissionDao.updateScoreWithRanking).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      profileId: TEST_PROFILE_ID_1,
      submissionId: TEST_SUBMISSION_ID_1,
      rankingScore: 11000,
    });
  });

  it('should recompute AVERAGE_LAPS score', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      cursor: null,
      data: [
        { lapNumber: 1, lapTimeMs: 10000, isValid: true },
        { lapNumber: 2, lapTimeMs: 20000, isValid: true },
      ],
    } as never);
    mockEventDao.load.mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.AVERAGE_LAPS });
    mockSubmissionDao.updateScoreWithRanking.mockResolvedValue(undefined);

    const result = await recalculateScoreIfSubmitted(RUN);

    expect(result).toBe(15000);
  });

  it('should recompute AVERAGE_LAPS score using only the event-configured averageLapsWindow', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      cursor: null,
      data: [
        { lapNumber: 1, lapTimeMs: 10000, isValid: true },
        { lapNumber: 2, lapTimeMs: 20000, isValid: true },
        { lapNumber: 3, lapTimeMs: 30000, isValid: true },
      ],
    } as never);
    mockEventDao.load.mockResolvedValue({
      ...TEST_EVENT_ITEM,
      raceFormat: RaceFormat.AVERAGE_LAPS,
      averageLapsWindow: 2,
    });
    mockSubmissionDao.updateScoreWithRanking.mockResolvedValue(undefined);

    const result = await recalculateScoreIfSubmitted(RUN);

    // Only the 2 most-recent valid laps (20000, 30000) are averaged, not all 3.
    expect(result).toBe(25000);
  });

  it('should skip gracefully when no valid laps remain', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      cursor: null,
      data: [{ lapNumber: 1, lapTimeMs: 15000, isValid: false }],
    } as never);
    mockEventDao.load.mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });

    const result = await recalculateScoreIfSubmitted(RUN);

    expect(result).toBeUndefined();
    expect(mockSubmissionDao.updateScoreWithRanking).not.toHaveBeenCalled();
  });

  it('should skip gracefully when the run has no submissionId', async () => {
    const result = await recalculateScoreIfSubmitted({ ...RUN, submissionId: undefined });

    expect(result).toBeUndefined();
    expect(mockLapDao.listByRun).not.toHaveBeenCalled();
    expect(mockSubmissionDao.updateScoreWithRanking).not.toHaveBeenCalled();
  });
});

describe('recalculateScoreIfSubmittedSafely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the recalculated score on success, same as recalculateScoreIfSubmitted', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      cursor: null,
      data: [{ lapNumber: 1, lapTimeMs: 11000, isValid: true }],
    } as never);
    mockEventDao.load.mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
    mockSubmissionDao.updateScoreWithRanking.mockResolvedValue(undefined);

    const result = await recalculateScoreIfSubmittedSafely(RUN);

    expect(result).toBe(11000);
  });

  it('should return undefined when the run is not SUBMITTED, same as recalculateScoreIfSubmitted', async () => {
    const result = await recalculateScoreIfSubmittedSafely({ ...RUN, runStatus: RunStatus.FINISHED });

    expect(result).toBeUndefined();
    expect(mockLapDao.listByRun).not.toHaveBeenCalled();
  });

  it('should swallow a ConflictError from a concurrent Ranking update and return undefined', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      cursor: null,
      data: [{ lapNumber: 1, lapTimeMs: 11000, isValid: true }],
    } as never);
    mockEventDao.load.mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
    mockSubmissionDao.updateScoreWithRanking.mockRejectedValue(
      new ConflictError({ message: 'Ranking changed concurrently. Please retry.' }),
    );

    const result = await recalculateScoreIfSubmittedSafely(RUN);

    expect(result).toBeUndefined();
  });

  it('should swallow any other unexpected error from the cascade and return undefined', async () => {
    mockLapDao.listByRun.mockRejectedValue(new Error('DynamoDB unavailable'));

    const result = await recalculateScoreIfSubmittedSafely(RUN);

    expect(result).toBeUndefined();
  });
});
