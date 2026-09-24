// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, lapDao, leaderboardDao, profileDao, raceStatsDao, runDao } from '@deepracer-indy/database';
import { BadRequestError, RunStatus, UserGroups } from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';
import type { EventBridgeEvent } from 'aws-lambda';

import { TEST_OPERATION_CONTEXT } from '../../api/constants/testConstants.js';
import { GetRaceStatsOperation } from '../../api/handlers/getStats.js';
import { cognitoClient } from '../../utils/clients/cognitoClient.js';
import { StatsRebuild } from '../statsRebuild.js';

const makeEvent = (): EventBridgeEvent<'race-submitted', unknown> =>
  ({
    source: 'deepracer.test',
    'detail-type': 'race-submitted',
    detail: {},
  }) as never;

const makeLb = (id: string, name = `Track ${id}`) => ({ leaderboardId: id, name }) as never;
const makeRun = (runId: string, profileId: string) => ({ runId, profileId }) as never;
const makeLap = (lapTimeMs: number, isValid = true) => ({ lapTimeMs, isValid, lapNumber: 1 }) as never;

describe('StatsRebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(raceStatsDao, 'putGlobal').mockResolvedValue(undefined);
    vi.spyOn(profileDao, 'load').mockResolvedValue({ alias: 'Alice' } as never);
    // Default: no events — individual tests override as needed
    vi.spyOn(eventDao, 'list').mockResolvedValue({ data: [], cursor: null } as never);
  });

  it('computes correct aggregates across leaderboards and runs', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({
      data: [makeLb('lb-1'), makeLb('lb-2')],
      cursor: null,
    } as never);

    vi.spyOn(runDao, 'list').mockImplementation(({ leaderboardId }: { leaderboardId: string; status?: RunStatus }) => {
      if (leaderboardId === 'lb-1')
        return Promise.resolve({ data: [makeRun('r1', 'p1'), makeRun('r2', 'p2')], cursor: null } as never);
      if (leaderboardId === 'lb-2') return Promise.resolve({ data: [makeRun('r3', 'p1')], cursor: null } as never); // p1 racer again
      return Promise.resolve({ data: [], cursor: null } as never);
    });

    vi.spyOn(lapDao, 'listAllLapsByRun').mockImplementation(({ runId }: { leaderboardId: string; runId: string }) => {
      if (runId === 'r1') return Promise.resolve({ data: [makeLap(5000), makeLap(6000)], cursor: null } as never);
      if (runId === 'r2')
        return Promise.resolve({ data: [makeLap(4500), makeLap(4500, false)], cursor: null } as never); // one invalid
      if (runId === 'r3') return Promise.resolve({ data: [makeLap(4000)], cursor: null } as never);
      return Promise.resolve({ data: [], cursor: null } as never);
    });

    await StatsRebuild(makeEvent());

    expect(raceStatsDao.putGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        totalEvents: 2, // 2 distinct leaderboards with submitted runs
        totalRacers: 2, // p1 and p2 (p1 counted once despite 2 runs)
        totalRaces: 3, // r1 + r2 + r3
        totalLaps: 5, // 2+2+1
        totalValidLaps: 4, // 2+1+1 (r2 lap2 invalid)
        sumValidLapTimeMs: 5000 + 6000 + 4500 + 4000, // 19500
      }),
    );
  });

  it('puts top-10 fastest valid laps sorted ascending', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [makeRun('r1', 'p1')], cursor: null } as never);

    // 12 valid laps - only top 10 should appear
    const laps = Array.from({ length: 12 }, (_, i) => makeLap((i + 1) * 1000));
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValueOnce({ data: laps, cursor: null } as never);

    await StatsRebuild(makeEvent());

    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    expect(call.fastestLapsEver).toHaveLength(10);
    expect(call.fastestLapsEver[0].lapTimeMilliseconds).toBe(1000); // fastest first
    expect(call.fastestLapsEver[9].lapTimeMilliseconds).toBe(10000);
    expect(call.fastestLapsEver[0].eventName).toBe('Track lb-1'); // resolved from the leaderboard name
  });

  it('excludes invalid laps from fastestLapsEver and sumValidLapTimeMs', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [makeRun('r1', 'p1')], cursor: null } as never);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValueOnce({
      data: [makeLap(1000, false), makeLap(5000, true)],
      cursor: null,
    } as never);

    await StatsRebuild(makeEvent());

    expect(raceStatsDao.putGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        totalLaps: 2,
        totalValidLaps: 1,
        sumValidLapTimeMs: 5000,
        fastestLapsEver: [expect.objectContaining({ lapTimeMilliseconds: 5000 })],
      }),
    );
  });

  it('writes zeroed stats when no submitted runs exist', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [], cursor: null } as never);

    await StatsRebuild(makeEvent());

    expect(raceStatsDao.putGlobal).toHaveBeenCalledWith({
      totalEvents: 0,
      totalRacers: 0,
      totalRaces: 0,
      totalLaps: 0,
      totalValidLaps: 0,
      sumValidLapTimeMs: 0,
      fastestLapsEver: [],
      totalCountries: 0,
      eventsByCountry: [],
      eventsByMonth: [],
      eventTypeBreakdown: [],
    });
  });

  it('continues if profile load fails, using profileId as name', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValue(new Error('profile not found'));
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [makeRun('r1', 'p1')], cursor: null } as never);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValueOnce({ data: [makeLap(5000)], cursor: null } as never);

    await StatsRebuild(makeEvent());

    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    expect(call.fastestLapsEver[0].participantName).toBe('p1'); // falls back to profileId
  });

  it('propagates putGlobal errors', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [], cursor: null } as never);
    vi.spyOn(raceStatsDao, 'putGlobal').mockRejectedValue(new Error('DDB error'));
    await expect(StatsRebuild(makeEvent())).rejects.toThrow('DDB error');
  });

  it('only aggregates SUBMITTED runs — status filter is applied', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [], cursor: null } as never);

    await StatsRebuild(makeEvent());

    expect(runDao.list).toHaveBeenCalledWith(expect.objectContaining({ status: RunStatus.SUBMITTED }));
  });

  it('paginates leaderboards across multiple pages', async () => {
    vi.spyOn(leaderboardDao, 'list')
      .mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: 'page2' } as never)
      .mockResolvedValueOnce({ data: [makeLb('lb-2')], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValue({ data: [makeRun('r1', 'p1')], cursor: null } as never);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [makeLap(5000)], cursor: null } as never);

    await StatsRebuild(makeEvent());

    expect(leaderboardDao.list).toHaveBeenCalledTimes(2);
    expect(leaderboardDao.list).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'page2' }));
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    expect(call.totalEvents).toBe(2); // both leaderboard pages accumulated
  });

  it('paginates runs within a leaderboard across multiple pages', async () => {
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
    vi.spyOn(runDao, 'list')
      .mockResolvedValueOnce({ data: [makeRun('r1', 'p1')], cursor: 'runpage2' } as never)
      .mockResolvedValueOnce({ data: [makeRun('r2', 'p2')], cursor: null } as never);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [makeLap(5000)], cursor: null } as never);

    await StatsRebuild(makeEvent());

    expect(runDao.list).toHaveBeenCalledTimes(2);
    expect(runDao.list).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'runpage2' }));
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    expect(call.totalRaces).toBe(2); // both run pages accumulated
  });
});

describe('GetRaceStatsOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
    // Default: admin user — individual tests override for non-admin cases
    vi.spyOn(cognitoClient, 'send').mockResolvedValue({ Groups: [{ GroupName: UserGroups.ADMIN }] } as never);
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
  });

  const baseStats = {
    totalEvents: 5,
    totalRacers: 20,
    totalLaps: 100,
    totalValidLaps: 80,
    totalRaces: 50,
    sumValidLapTimeMs: 400000,
    fastestLapsEver: [
      { participantName: 'Alice', lapTimeMilliseconds: 4500, eventId: 'evt-1', eventName: 'Summer Slam' },
    ],
    totalCountries: 3,
    eventsByCountry: [{ countryCode: 'US', events: 3, races: 30, laps: 60 }],
    eventsByMonth: [{ month: '2026-08', events: 5, races: 50, laps: 100 }],
    eventTypeBreakdown: [{ typeOfEvent: 'AWS_SUMMIT', count: 3 }],
  };

  it('returns stats with derived averageLapTimeMilliseconds', async () => {
    vi.spyOn(raceStatsDao, 'getGlobal').mockResolvedValue(baseStats as never);

    const result = await GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT);

    expect(result.totalEvents).toBe(5);
    expect(result.totalRacers).toBe(20);
    expect(result.totalRaces).toBe(50);
    expect(result.totalLaps).toBe(100);
    expect(result.totalValidLaps).toBe(80);
    expect(result.averageLapTimeMilliseconds).toBe(5000); // 400000 / 80
    expect(result.fastestLapsEver).toHaveLength(1);
    expect(result.fastestLapsEver[0].participantName).toBe('Alice');
    expect(result.fastestLapsEver[0].eventName).toBe('Summer Slam');
  });

  it('returns averageLapTimeMilliseconds=0 when no valid laps', async () => {
    vi.spyOn(raceStatsDao, 'getGlobal').mockResolvedValue({
      ...baseStats,
      totalValidLaps: 0,
      sumValidLapTimeMs: 0,
    } as never);

    const result = await GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT);
    expect(result.averageLapTimeMilliseconds).toBe(0);
  });

  it('returns zeroed defaults when no stats exist yet', async () => {
    vi.spyOn(raceStatsDao, 'getGlobal').mockResolvedValue(null);

    const result = await GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT);
    expect(result.totalEvents).toBe(0);
    expect(result.totalRacers).toBe(0);
    expect(result.fastestLapsEver).toHaveLength(0);
    expect(result.averageLapTimeMilliseconds).toBe(0);
    expect(result.totalCountries).toBe(0);
    expect(result.eventsByCountry).toHaveLength(0);
    expect(result.eventsByMonth).toHaveLength(0);
    expect(result.eventTypeBreakdown).toHaveLength(0);
  });

  it('returns totalCountries and country breakdown', async () => {
    vi.spyOn(raceStatsDao, 'getGlobal').mockResolvedValue(baseStats as never);
    const result = await GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT);
    expect(result.totalCountries).toBe(3);
    expect(result.eventsByCountry).toHaveLength(1);
    expect(result.eventsByCountry[0].countryCode).toBe('US');
  });

  it('returns eventsByMonth', async () => {
    vi.spyOn(raceStatsDao, 'getGlobal').mockResolvedValue(baseStats as never);
    const result = await GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT);
    expect(result.eventsByMonth).toHaveLength(1);
    expect(result.eventsByMonth[0].month).toBe('2026-08');
  });

  it('returns eventTypeBreakdown', async () => {
    vi.spyOn(raceStatsDao, 'getGlobal').mockResolvedValue(baseStats as never);
    const result = await GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT);
    expect(result.eventTypeBreakdown).toHaveLength(1);
    expect(result.eventTypeBreakdown[0].typeOfEvent).toBe('AWS_SUMMIT');
    expect(result.eventTypeBreakdown[0].count).toBe(3);
  });

  it('throws BadRequestError when caller is not an admin', async () => {
    vi.spyOn(cognitoClient, 'send').mockResolvedValue({ Groups: [{ GroupName: UserGroups.RACERS }] } as never);
    await expect(GetRaceStatsOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });
});

describe('StatsRebuild — event aggregations', () => {
  const makeEventRecord = (id: string, countryCode: string, eventType: string, eventDate: string) =>
    ({ eventId: id, countryCode, eventType, eventDate }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(raceStatsDao, 'putGlobal').mockResolvedValue(undefined);
    vi.spyOn(profileDao, 'load').mockResolvedValue({ alias: 'Alice' } as never);
    vi.spyOn(leaderboardDao, 'list').mockResolvedValue({ data: [], cursor: null } as never);
    vi.spyOn(runDao, 'list').mockResolvedValue({ data: [], cursor: null } as never);
  });

  it('computes totalCountries from distinct event countryCode values', async () => {
    vi.spyOn(eventDao, 'list').mockResolvedValueOnce({
      data: [
        makeEventRecord('e1', 'US', 'AWS_SUMMIT', '2026-08-01T00:00:00Z'),
        makeEventRecord('e2', 'GB', 'OFFICIAL_TRACK_RACE', '2026-08-02T00:00:00Z'),
        makeEventRecord('e3', 'US', 'AWS_SUMMIT', '2026-08-03T00:00:00Z'),
      ],
      cursor: null,
    } as never);

    await StatsRebuild(makeEvent());
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    expect(call.totalCountries).toBe(2); // US and GB
  });

  it('computes eventsByCountry grouped by countryCode', async () => {
    vi.spyOn(eventDao, 'list').mockResolvedValueOnce({
      data: [
        makeEventRecord('e1', 'US', 'AWS_SUMMIT', '2026-08-01T00:00:00Z'),
        makeEventRecord('e2', 'US', 'AWS_SUMMIT', '2026-08-02T00:00:00Z'),
        makeEventRecord('e3', 'GB', 'OFFICIAL_TRACK_RACE', '2026-08-03T00:00:00Z'),
      ],
      cursor: null,
    } as never);

    await StatsRebuild(makeEvent());
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    const us = call.eventsByCountry.find((c: { countryCode: string }) => c.countryCode === 'US');
    expect(us?.events).toBe(2);
    const gb = call.eventsByCountry.find((c: { countryCode: string }) => c.countryCode === 'GB');
    expect(gb?.events).toBe(1);
  });

  it('computes eventsByMonth in YYYY-MM format', async () => {
    vi.spyOn(eventDao, 'list').mockResolvedValueOnce({
      data: [
        makeEventRecord('e1', 'US', 'AWS_SUMMIT', '2026-07-15T00:00:00Z'),
        makeEventRecord('e2', 'US', 'AWS_SUMMIT', '2026-08-01T00:00:00Z'),
        makeEventRecord('e3', 'US', 'AWS_SUMMIT', '2026-08-20T00:00:00Z'),
      ],
      cursor: null,
    } as never);

    await StatsRebuild(makeEvent());
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    const july = call.eventsByMonth.find((m: { month: string }) => m.month === '2026-07');
    expect(july?.events).toBe(1);
    const august = call.eventsByMonth.find((m: { month: string }) => m.month === '2026-08');
    expect(august?.events).toBe(2);
  });

  it('computes eventTypeBreakdown grouped by eventType', async () => {
    vi.spyOn(eventDao, 'list').mockResolvedValueOnce({
      data: [
        makeEventRecord('e1', 'US', 'AWS_SUMMIT', '2026-08-01T00:00:00Z'),
        makeEventRecord('e2', 'US', 'AWS_SUMMIT', '2026-08-02T00:00:00Z'),
        makeEventRecord('e3', 'US', 'OFFICIAL_TRACK_RACE', '2026-08-03T00:00:00Z'),
      ],
      cursor: null,
    } as never);

    await StatsRebuild(makeEvent());
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];
    const summit = call.eventTypeBreakdown.find((t: { typeOfEvent: string }) => t.typeOfEvent === 'AWS_SUMMIT');
    expect(summit?.count).toBe(2);
    const track = call.eventTypeBreakdown.find((t: { typeOfEvent: string }) => t.typeOfEvent === 'OFFICIAL_TRACK_RACE');
    expect(track?.count).toBe(1);
  });

  it('joins leaderboard races/laps onto eventsByCountry and eventsByMonth when leaderboardId equals eventId', async () => {
    // leaderboardId 'e1' === eventId 'e1' — the join should produce non-zero races/laps
    vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({
      data: [{ leaderboardId: 'e1' }],
      cursor: null,
    } as never);
    vi.spyOn(runDao, 'list').mockResolvedValueOnce({
      data: [
        { runId: 'r1', profileId: 'p1' },
        { runId: 'r2', profileId: 'p2' },
      ],
      cursor: null,
    } as never);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
      data: [{ lapTimeMs: 45000, isValid: true, lapNumber: 1, participantName: 'Alice', eventId: 'e1' }],
      cursor: null,
    } as never);
    vi.spyOn(eventDao, 'list').mockResolvedValueOnce({
      data: [makeEventRecord('e1', 'US', 'AWS_SUMMIT', '2026-08-01T00:00:00Z')],
      cursor: null,
    } as never);

    await StatsRebuild(makeEvent());
    const call = vi.mocked(raceStatsDao.putGlobal).mock.calls[0][0];

    // eventsByCountry: US should have 1 event, 2 races, 2 laps (2 runs × 1 lap each)
    const us = call.eventsByCountry.find((c: { countryCode: string }) => c.countryCode === 'US');
    expect(us?.events).toBe(1);
    expect(us?.races).toBe(2);
    expect(us?.laps).toBe(2);

    // eventsByMonth: 2026-08 should have same counts
    const aug = call.eventsByMonth.find((m: { month: string }) => m.month === '2026-08');
    expect(aug?.events).toBe(1);
    expect(aug?.races).toBe(2);
    expect(aug?.laps).toBe(2);
  });

  describe('telemetry reporting', () => {
    it('reports only aggregate counts to metricsLogger — no participant names or per-race identifiers', async () => {
      const logSpy = vi.spyOn(metricsLogger, 'logRaceManagementStatsRebuilt').mockImplementation(() => undefined);

      vi.spyOn(eventDao, 'list').mockResolvedValueOnce({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
      vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [makeRun('r1', 'p1')], cursor: null } as never);
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValueOnce({ data: [makeLap(5000)], cursor: null } as never);

      await StatsRebuild(makeEvent());

      expect(logSpy).toHaveBeenCalledTimes(1);
      const payload = logSpy.mock.calls[0][0];

      // Only these 6 aggregate-count fields must be present — nothing per-user or per-race.
      expect(payload).toEqual({
        totalEvents: 1,
        totalRacers: 1,
        totalRaces: 1,
        totalLaps: 1,
        totalValidLaps: 1,
        totalCountries: 0,
      });
      expect(payload).not.toHaveProperty('profileId');
      expect(payload).not.toHaveProperty('participantName');
      expect(payload).not.toHaveProperty('fastestLapsEver');
      expect(payload).not.toHaveProperty('eventsByCountry');
    });

    it('does not fail the rebuild when telemetry reporting throws', async () => {
      vi.spyOn(metricsLogger, 'logRaceManagementStatsRebuilt').mockImplementation(() => {
        throw new Error('metrics logging failed');
      });
      vi.spyOn(eventDao, 'list').mockResolvedValueOnce({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'list').mockResolvedValueOnce({ data: [makeLb('lb-1')], cursor: null } as never);
      vi.spyOn(runDao, 'list').mockResolvedValueOnce({ data: [makeRun('r1', 'p1')], cursor: null } as never);
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValueOnce({ data: [makeLap(5000)], cursor: null } as never);

      await expect(StatsRebuild(makeEvent())).resolves.toBeUndefined();

      // The actual rebuild write must still have happened despite the telemetry failure.
      expect(raceStatsDao.putGlobal).toHaveBeenCalledTimes(1);
    });
  });
});
