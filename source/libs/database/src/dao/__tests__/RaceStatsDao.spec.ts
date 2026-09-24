// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());

vi.mock('../RaceStatsDao.js', async () => {
  const actual = await vi.importActual<typeof import('../RaceStatsDao.js')>('../RaceStatsDao.js');
  return actual;
});

vi.mock('../../entities/RaceStatsEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/RaceStatsEntity.js')>(
    '../../entities/RaceStatsEntity.js',
  );
  return {
    ...actual,
    RaceStatsEntity: {
      get: vi.fn(() => ({ go: mockGet })),
      put: vi.fn(() => ({ go: mockPut })),
    },
  };
});

const { raceStatsDao } = await import('../RaceStatsDao.js');

const MOCK_STATS = {
  totalEvents: 5,
  totalRacers: 12,
  totalLaps: 48,
  totalValidLaps: 40,
  totalRaces: 20,
  sumValidLapTimeMs: 120000,
  fastestLapsEver: [{ participantName: 'Alice', lapTimeMilliseconds: 3000, eventId: 'evt-1' }],
  totalCountries: 3,
  eventsByCountry: [{ countryCode: 'US', events: 3, races: 10, laps: 30 }],
  eventsByMonth: [{ month: '2026-08', events: 5, races: 20, laps: 48 }],
  eventTypeBreakdown: [{ typeOfEvent: 'OFFICIAL_TRACK_RACE', count: 5 }],
};

describe('RaceStatsDao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGlobal', () => {
    it('should return the global stats item when it exists', async () => {
      mockGet.mockResolvedValue({ data: MOCK_STATS });

      const result = await raceStatsDao.getGlobal();

      expect(result).toEqual(MOCK_STATS);
    });

    it('should return null when no stats exist yet', async () => {
      mockGet.mockResolvedValue({ data: null });

      const result = await raceStatsDao.getGlobal();

      expect(result).toBeNull();
    });

    it('should propagate DynamoDB errors naturally', async () => {
      mockGet.mockRejectedValue(new Error('DynamoDB error'));

      await expect(raceStatsDao.getGlobal()).rejects.toThrow('DynamoDB error');
    });
  });

  describe('putGlobal', () => {
    it('should write the stats item without error', async () => {
      mockPut.mockResolvedValue({});

      await expect(raceStatsDao.putGlobal(MOCK_STATS)).resolves.toBeUndefined();
    });

    it('should propagate DynamoDB errors naturally', async () => {
      mockPut.mockRejectedValue(new Error('DynamoDB write error'));

      await expect(raceStatsDao.putGlobal(MOCK_STATS)).rejects.toThrow('DynamoDB write error');
    });
  });
});
