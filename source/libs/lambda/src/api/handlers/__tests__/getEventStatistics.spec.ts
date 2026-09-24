// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  lapDao,
  type LapItem,
  type ResourceId,
  runDao,
  type RunItem,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_LEADERBOARD_ID,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  NotAuthorizedError,
  NotFoundError,
  RunStatus,
  UserGroups,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetEventStatisticsOperation, MAX_RUNS_FOR_STATISTICS } from '../getEventStatistics.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserMemberOf: (...args: unknown[]) => mockIsUserMemberOf(...args) };
});

const mockIsUserMemberOf = vi.fn().mockResolvedValue(true);

const makeRun = (overrides: Partial<RunItem> = {}): RunItem => ({
  runId: 'run-1' as ResourceId,
  leaderboardId: TEST_LEADERBOARD_ID,
  eventId: TEST_EVENT_ID,
  profileId: 'profile-1' as ResourceId,
  runStatus: RunStatus.SUBMITTED,
  racedByProxy: false,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const makeLap = (overrides: Partial<LapItem> = {}): LapItem => ({
  runId: 'run-1' as ResourceId,
  leaderboardId: TEST_LEADERBOARD_ID,
  lapNumber: 1,
  lapTimeMs: 10000,
  isValid: true,
  resets: 0,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

describe('GetEventStatistics operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserMemberOf.mockResolvedValue(true);
    vi.spyOn(eventDao, 'load').mockResolvedValue(TEST_EVENT_ITEM);
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    mockIsUserMemberOf.mockResolvedValueOnce(false);

    await expect(GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('should authorize administrators, facilitators, and commentators', async () => {
    vi.spyOn(runDao, 'listAllByEvent').mockResolvedValue([]);

    await GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(mockIsUserMemberOf).toHaveBeenCalledWith(TEST_OPERATION_CONTEXT.profileId, [
      UserGroups.ADMIN,
      UserGroups.RACE_FACILITATORS,
      UserGroups.COMMENTATORS,
    ]);
  });

  it('should reject events above the supported run limit before querying laps', async () => {
    const runs = Array.from({ length: MAX_RUNS_FOR_STATISTICS + 1 }, (_, index) =>
      makeRun({ runId: `run-${index}` as ResourceId }),
    );
    const listAllByEvent = vi.spyOn(runDao, 'listAllByEvent').mockResolvedValue(runs);
    const listByRun = vi.spyOn(lapDao, 'listAllLapsByRun');

    await expect(GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({ message: `Event statistics are limited to ${MAX_RUNS_FOR_STATISTICS} runs.` }),
    );

    expect(listAllByEvent).toHaveBeenCalledWith({
      eventId: TEST_EVENT_ID,
      maxResults: MAX_RUNS_FOR_STATISTICS + 1,
    });
    expect(listByRun).not.toHaveBeenCalled();
  });

  it('should compute aggregate metrics across all runs and laps for the event', async () => {
    const runs = [
      makeRun({ runId: 'run-1' as ResourceId, profileId: 'profile-1' as ResourceId, runStatus: RunStatus.SUBMITTED }),
      makeRun({ runId: 'run-2' as ResourceId, profileId: 'profile-2' as ResourceId, runStatus: RunStatus.SUBMITTED }),
      makeRun({ runId: 'run-3' as ResourceId, profileId: 'profile-1' as ResourceId, runStatus: RunStatus.DISCARDED }),
    ];
    vi.spyOn(runDao, 'listAllByEvent').mockResolvedValue(runs);

    vi.spyOn(lapDao, 'listAllLapsByRun').mockImplementation(({ runId }) => {
      if (runId === 'run-1') {
        return Promise.resolve({
          data: [
            makeLap({ runId: 'run-1' as ResourceId, lapNumber: 1, lapTimeMs: 9000, isValid: true }),
            makeLap({ runId: 'run-1' as ResourceId, lapNumber: 2, lapTimeMs: 11000, isValid: false }),
          ],
          cursor: null,
        });
      }
      if (runId === 'run-2') {
        return Promise.resolve({
          data: [makeLap({ runId: 'run-2' as ResourceId, lapNumber: 1, lapTimeMs: 7000, isValid: true })],
          cursor: null,
        });
      }
      return Promise.resolve({ data: [], cursor: null });
    });

    const output = await GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(eventDao.load).toHaveBeenCalledWith({ eventId: TEST_EVENT_ID });
    expect(output.statistics.totalRuns).toBe(3);
    expect(output.statistics.completedRuns).toBe(2);
    expect(output.statistics.discardedRuns).toBe(1);
    expect(output.statistics.totalValidLaps).toBe(2);
    expect(output.statistics.uniqueRacerCount).toBe(2);
    // completionRate = completedRuns / nonDiscardedRuns = 2 / 2
    expect(output.statistics.completionRate).toBe(1);
    // averageLapsPerRun = totalValidLaps / totalRuns = 2 / 3
    expect(output.statistics.averageLapsPerRun).toBeCloseTo(2 / 3);
    expect(output.statistics.fastestLapMs).toBe(7000);
    expect(output.statistics.averageLapTimeMs).toBe(8000);
  });

  it('should omit fastestLapMs and averageLapTimeMs when there are no valid laps', async () => {
    vi.spyOn(runDao, 'listAllByEvent').mockResolvedValue([makeRun({ runStatus: RunStatus.READY })]);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [], cursor: null });

    const output = await GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(output.statistics.fastestLapMs).toBeUndefined();
    expect(output.statistics.averageLapTimeMs).toBeUndefined();
    expect(output.statistics.totalValidLaps).toBe(0);
  });

  it('should return zeroed metrics when the event has no runs', async () => {
    vi.spyOn(runDao, 'listAllByEvent').mockResolvedValue([]);

    const output = await GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(output.statistics.totalRuns).toBe(0);
    expect(output.statistics.completedRuns).toBe(0);
    expect(output.statistics.discardedRuns).toBe(0);
    expect(output.statistics.uniqueRacerCount).toBe(0);
    expect(output.statistics.completionRate).toBe(0);
    expect(output.statistics.averageLapsPerRun).toBe(0);
  });

  it('should exclude invalid laps from fastestLapMs and averageLapTimeMs', async () => {
    vi.spyOn(runDao, 'listAllByEvent').mockResolvedValue([makeRun()]);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
      data: [
        makeLap({ lapNumber: 1, lapTimeMs: 5000, isValid: false }),
        makeLap({ lapNumber: 2, lapTimeMs: 9000, isValid: true }),
      ],
      cursor: null,
    });

    const output = await GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT);

    expect(output.statistics.fastestLapMs).toBe(9000);
    expect(output.statistics.averageLapTimeMs).toBe(9000);
    expect(output.statistics.totalValidLaps).toBe(1);
  });

  it('should translate the DAO not-found error into a modeled NotFoundError', async () => {
    const daoError = new NotFoundError({ message: 'Item not found.' });
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(daoError);

    await expect(GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotFoundError({ message: 'Item not found.' }),
    );
  });

  it('should propagate unexpected DAO errors unchanged', async () => {
    const databaseError = new Error('DynamoDB unavailable');
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(databaseError);

    await expect(GetEventStatisticsOperation({ eventId: TEST_EVENT_ID }, TEST_OPERATION_CONTEXT)).rejects.toBe(
      databaseError,
    );
  });
});
