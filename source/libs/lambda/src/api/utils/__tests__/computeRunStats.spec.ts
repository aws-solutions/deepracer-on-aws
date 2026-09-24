// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LapItem } from '@deepracer-indy/database';

import { computeRunStats } from '../computeRunStats.js';

const lap = (overrides: Partial<LapItem>): LapItem =>
  ({
    leaderboardId: 'leaderboard-1',
    runId: 'run-1',
    lapNumber: 1,
    lapTimeMs: 10000,
    isValid: true,
    resets: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as LapItem;

describe('computeRunStats', () => {
  it('should derive stats from all valid laps', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 12000, resets: 1 }),
      lap({ lapNumber: 2, lapTimeMs: 9000, resets: 3 }),
      lap({ lapNumber: 3, lapTimeMs: 11000, resets: 2 }),
    ];

    expect(computeRunStats(laps)).toEqual({
      avgLapTime: 10667,
      avgResets: 2,
      bestLapTime: 9000,
      collisionCount: 0,
      completedLapCount: 3,
      offTrackCount: 0,
      resetCount: 6,
      totalLapTime: 32000,
    });
  });

  it('should round a non-integer average lap time and average resets', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 10000, resets: 1 }),
      lap({ lapNumber: 2, lapTimeMs: 10001, resets: 0 }),
    ];

    expect(computeRunStats(laps)).toEqual({
      avgLapTime: 10001,
      avgResets: 0.5,
      bestLapTime: 10000,
      collisionCount: 0,
      completedLapCount: 2,
      offTrackCount: 0,
      resetCount: 1,
      totalLapTime: 20001,
    });
  });

  it('should exclude invalid laps from every stat', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 8000, resets: 5, isValid: false }),
      lap({ lapNumber: 2, lapTimeMs: 11000, resets: 2, isValid: true }),
      lap({ lapNumber: 3, lapTimeMs: 13000, resets: 4, isValid: true }),
    ];

    expect(computeRunStats(laps)).toEqual({
      avgLapTime: 12000,
      avgResets: 3,
      bestLapTime: 11000,
      collisionCount: 0,
      completedLapCount: 2,
      offTrackCount: 0,
      resetCount: 6,
      totalLapTime: 24000,
    });
  });

  it('should treat a missing resets value as zero', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 10000, resets: undefined }),
      lap({ lapNumber: 2, lapTimeMs: 12000, resets: 2 }),
    ];

    expect(computeRunStats(laps)).toEqual({
      avgLapTime: 11000,
      avgResets: 1,
      bestLapTime: 10000,
      collisionCount: 0,
      completedLapCount: 2,
      offTrackCount: 0,
      resetCount: 2,
      totalLapTime: 22000,
    });
  });

  it('should report stats for a single valid lap', () => {
    const laps = [lap({ lapNumber: 1, lapTimeMs: 15000, resets: 1 })];

    expect(computeRunStats(laps)).toEqual({
      avgLapTime: 15000,
      avgResets: 1,
      bestLapTime: 15000,
      collisionCount: 0,
      completedLapCount: 1,
      offTrackCount: 0,
      resetCount: 1,
      totalLapTime: 15000,
    });
  });
});
