// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * CreateLap's ConflictError message when the run is not IN_PROGRESS. The Timekeeping page tells it
 * apart from a lap-number conflict (a lost lap-count race or a replayed idempotency token).
 */
export const RUN_NOT_IN_PROGRESS_MESSAGE = 'Run is not in progress.';

/** Shortest plausible auto-timed lap. Anything faster is most likely a sensor double-trigger. */
export const AUTO_LAP_MIN_TIME_MS = 3_000;

/** Longest plausible auto-timed lap. Anything slower is most likely a missed crossing. */
export const AUTO_LAP_MAX_TIME_MS = 300_000;

/** True when an auto-timed lap time falls outside the plausible range. */
export const isAutoLapTimeOutOfRange = (lapTimeMs: number): boolean =>
  lapTimeMs < AUTO_LAP_MIN_TIME_MS || lapTimeMs > AUTO_LAP_MAX_TIME_MS;

/**
 * True when a lap should be saved as invalid pending facilitator review: timer crossings were (or
 * may have been) lost, so the time may span more than one lap, whatever clock timed it; or an
 * auto-timed lap's time is out of range. Manual laps are otherwise the facilitator's own judgement.
 * Shared by CreateLap (source of truth) and the Timekeeping page (optimistic display).
 */
export const isLapReviewRequired = ({
  timingSource,
  lapTimeMs,
  missedCrossings = 0,
}: {
  timingSource: 'MANUAL' | 'AUTO';
  lapTimeMs: number;
  missedCrossings?: number;
}): boolean => missedCrossings > 0 || (timingSource === 'AUTO' && isAutoLapTimeOutOfRange(lapTimeMs));
