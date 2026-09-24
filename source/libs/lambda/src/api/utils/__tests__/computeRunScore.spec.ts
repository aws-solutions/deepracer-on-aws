// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LapItem } from '@deepracer-indy/database';
import { ConflictError, RaceFormat } from '@deepracer-indy/typescript-server-client';

import { computeRunScore } from '../computeRunScore.js';

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

describe('computeRunScore', () => {
  it('should return the minimum lapTimeMs for BEST_LAP', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 12000 }),
      lap({ lapNumber: 2, lapTimeMs: 9000 }),
      lap({ lapNumber: 3, lapTimeMs: 11000 }),
    ];

    expect(computeRunScore(RaceFormat.BEST_LAP, laps)).toEqual(9000);
  });

  it('should return the rounded average lapTimeMs for AVERAGE_LAPS', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 10000 }),
      lap({ lapNumber: 2, lapTimeMs: 11000 }),
      lap({ lapNumber: 3, lapTimeMs: 12000 }),
    ];

    expect(computeRunScore(RaceFormat.AVERAGE_LAPS, laps)).toEqual(11000);
  });

  it('should round a non-integer average', () => {
    const laps = [lap({ lapNumber: 1, lapTimeMs: 10000 }), lap({ lapNumber: 2, lapTimeMs: 10001 })];

    expect(computeRunScore(RaceFormat.AVERAGE_LAPS, laps)).toEqual(10001);
  });

  it('should exclude invalid laps from BEST_LAP scoring', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 8000, isValid: false }),
      lap({ lapNumber: 2, lapTimeMs: 11000, isValid: true }),
    ];

    expect(computeRunScore(RaceFormat.BEST_LAP, laps)).toEqual(11000);
  });

  it('should exclude invalid laps from AVERAGE_LAPS scoring', () => {
    const laps = [
      lap({ lapNumber: 1, lapTimeMs: 100000, isValid: false }),
      lap({ lapNumber: 2, lapTimeMs: 10000, isValid: true }),
      lap({ lapNumber: 3, lapTimeMs: 12000, isValid: true }),
    ];

    expect(computeRunScore(RaceFormat.AVERAGE_LAPS, laps)).toEqual(11000);
  });

  it('should throw ConflictError when there are zero laps', () => {
    expect(() => computeRunScore(RaceFormat.BEST_LAP, [])).toThrow(ConflictError);
  });

  it('should throw ConflictError when all laps are invalid', () => {
    const laps = [lap({ lapNumber: 1, isValid: false }), lap({ lapNumber: 2, isValid: false })];

    expect(() => computeRunScore(RaceFormat.BEST_LAP, laps)).toThrow(ConflictError);
  });
});
