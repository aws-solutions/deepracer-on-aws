// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LapItem } from '@deepracer-indy/database';
import { ConflictError, RaceFormat } from '@deepracer-indy/typescript-server-client';

/**
 * Computes a Run's score from its recorded laps, per the event's configured
 * raceFormat:
 *  - BEST_LAP: the minimum lapTimeMs across valid laps.
 *  - AVERAGE_LAPS: the average lapTimeMs across valid laps.
 *
 * Invalid laps (isValid === false) are excluded from scoring.
 *
 * @throws {ConflictError} if there are zero valid laps — a run cannot be
 *   submitted with no scoring data (`NO_VALID_LAPS`).
 */
export const computeRunScore = (raceFormat: RaceFormat, laps: readonly LapItem[]): number => {
  const validLaps = laps.filter((lap) => lap.isValid);

  if (validLaps.length === 0) {
    throw new ConflictError({ message: 'Cannot submit: run has no valid laps.' });
  }

  const lapTimes = validLaps.map((lap) => lap.lapTimeMs);

  switch (raceFormat) {
    case RaceFormat.BEST_LAP:
      return Math.min(...lapTimes);
    case RaceFormat.AVERAGE_LAPS:
      return Math.round(lapTimes.reduce((sum, lapTimeMs) => sum + lapTimeMs, 0) / lapTimes.length);
    default:
      throw new Error(`Unsupported raceFormat: ${raceFormat satisfies never}`);
  }
};
