// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LapItem, RankingItem } from '@deepracer-indy/database';

/**
 * Derives the Ranking stats for a physical Run from its recorded laps.
 *
 * Physical lap telemetry only captures lapTimeMs, isValid, and resets — there
 * is no collision or off-track telemetry on a physical track, so those counts
 * are recorded as 0. Invalid laps (isValid === false) are excluded, matching
 * computeRunScore.
 *
 * Callers must guarantee at least one valid lap (computeRunScore throws
 * ConflictError otherwise) before calling this.
 */
export const computeRunStats = (laps: readonly LapItem[]): RankingItem['stats'] => {
  const validLaps = laps.filter((lap) => lap.isValid);
  const lapTimes = validLaps.map((lap) => lap.lapTimeMs);
  const totalLapTime = lapTimes.reduce((sum, lapTimeMs) => sum + lapTimeMs, 0);
  const resetCount = validLaps.reduce((sum, lap) => sum + (lap.resets ?? 0), 0);

  return {
    avgLapTime: Math.round(totalLapTime / validLaps.length),
    avgResets: resetCount / validLaps.length,
    bestLapTime: Math.min(...lapTimes),
    collisionCount: 0,
    completedLapCount: validLaps.length,
    offTrackCount: 0,
    resetCount,
    totalLapTime,
  };
};
