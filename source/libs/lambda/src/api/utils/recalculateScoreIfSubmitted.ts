// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, lapDao, submissionDao, type ResourceId } from '@deepracer-indy/database';
import { RaceFormat, RunStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

/**
 * Computes a run's score from its valid laps, per the event's configured race format.
 *
 * - BEST_LAP: the minimum lapTimeMs across valid laps.
 * - AVERAGE_LAPS: the average lapTimeMs across the `averageLapsWindow` most-recent valid laps
 *   (or all valid laps if `averageLapsWindow` is unset, or the racer has fewer laps than the
 *   window). `lapTimesMs` must be ordered oldest-to-newest (see `lapDao.listByRun`, which sorts
 *   ascending by `lapNumber`) so the "most recent" laps are the trailing elements.
 *
 * Returns `undefined` if there are no valid laps to score.
 */
export const computeScoreFromLaps = (
  lapTimesMs: number[],
  raceFormat: RaceFormat,
  averageLapsWindow?: number,
): number | undefined => {
  if (lapTimesMs.length === 0) {
    return undefined;
  }

  if (raceFormat === RaceFormat.BEST_LAP) {
    return Math.min(...lapTimesMs);
  }

  const windowedLapTimesMs = averageLapsWindow ? lapTimesMs.slice(-averageLapsWindow) : lapTimesMs;

  return windowedLapTimesMs.reduce((sum, lapTimeMs) => sum + lapTimeMs, 0) / windowedLapTimesMs.length;
};

/** The subset of a Run item needed to recalculate its score. */
export interface RecalculatableRun {
  leaderboardId: ResourceId;
  runId: ResourceId;
  eventId: ResourceId;
  profileId: ResourceId;
  runStatus: string;
  submissionId?: ResourceId;
}

/**
 * Recalculates and persists a run's score when a lap is edited or its validity
 * changes after the parent run has already been SUBMITTED. Called by SetLapValidity and UpdateLap.
 *
 * No-op (returns `undefined`) when:
 * - The run has not been SUBMITTED (nothing to recalculate).
 * - There are no valid laps remaining (recalculation would be meaningless; the lap edit/validity
 *   change itself still succeeds — this helper never throws to block that).
 * - The run has no `submissionId` — this can only happen if the run's SUBMITTED transition
 *   (runLifecycleFunction) has not yet created one, which should not occur once that handler is
 *   in place; logged defensively rather than thrown so a lap edit is never blocked by an
 *   inconsistency in an unrelated part of the pipeline.
 *
 * The Submission is resolved directly by `submissionId` (persisted on the Run at SUBMITTED time)
 * rather than by "most recently created submission for this racer on this leaderboard" — a racer
 * can have multiple runs/submissions on the same leaderboard, so picking the newest one could
 * silently overwrite the wrong submission's score.
 *
 * On success, atomically updates both the Submission's and the Ranking's `rankingScore` (via a
 * single DynamoDB transaction — see `SubmissionDao.updateScoreWithRanking`) and returns the new
 * score so the caller can include it in the API response.
 */
export const recalculateScoreIfSubmitted = async (run: RecalculatableRun): Promise<number | undefined> => {
  if (run.runStatus !== RunStatus.SUBMITTED) {
    return undefined;
  }

  const { leaderboardId, runId, eventId, profileId, submissionId } = run;

  if (!submissionId) {
    logger.warn('Skipping score recalculation: SUBMITTED run has no submissionId.', {
      leaderboardId,
      runId,
      profileId,
    });
    return undefined;
  }

  const [{ data: laps }, event] = await Promise.all([
    lapDao.listByRun({ leaderboardId, runId }),
    eventDao.load({ eventId }),
  ]);

  const validLapTimesMs = laps.filter((lap) => lap.isValid).map((lap) => lap.lapTimeMs);
  const newScore = computeScoreFromLaps(validLapTimesMs, event.raceFormat, event.averageLapsWindow);

  if (newScore === undefined) {
    logger.warn('Skipping score recalculation: no valid laps remain for a SUBMITTED run.', {
      leaderboardId,
      runId,
      profileId,
    });
    return undefined;
  }

  await submissionDao.updateScoreWithRanking({
    leaderboardId,
    profileId,
    submissionId,
    rankingScore: newScore,
  });

  return newScore;
};

/**
 * Wraps {@link recalculateScoreIfSubmitted} so a cascade failure (most notably
 * {@link ConflictError} from a concurrent Ranking update — see `SubmissionDao.updateScoreWithRanking`)
 * never fails the lap edit/validity change that triggered it. Called by SetLapValidity and UpdateLap
 * in place of calling `recalculateScoreIfSubmitted` directly.
 *
 * The lap write has already committed by the time this runs — the edit itself is a done deal.
 * Letting a cascade failure propagate would turn a successful lap edit into a client-visible 500,
 * discarding the already-persisted `lap` from the response for a failure in an unrelated derived
 * value (the recomputed score/ranking). Any resulting staleness is bounded and self-healing: the
 * next lap edit for this run re-triggers the cascade with a fresh read, and a facilitator can
 * always trigger a full leaderboard rebuild (`statsRebuildFn`) if needed in the meantime.
 *
 * Returns `undefined` (omitting `rankingScore` from the API response) on any cascade failure,
 * after logging it for visibility.
 */
export const recalculateScoreIfSubmittedSafely = async (run: RecalculatableRun): Promise<number | undefined> => {
  try {
    return await recalculateScoreIfSubmitted(run);
  } catch (error) {
    logger.warn('Score recalculation cascade failed after the lap edit was already persisted.', {
      leaderboardId: run.leaderboardId,
      runId: run.runId,
      profileId: run.profileId,
      submissionId: run.submissionId,
      error,
    });
    return undefined;
  }
};
