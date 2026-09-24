// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Leaderboard, LiveEventStatus } from '@deepracer-indy/typescript-client';

/** Returns true when a (non-live) community race's submission window is currently open. */
export const isActiveRace = (leaderboard: Leaderboard): boolean => {
  const now = new Date();
  return !leaderboard.isLive && now >= leaderboard.openTime && now < leaderboard.closeTime;
};

/** Returns true when the delete button should be disabled. */
export const isDeleteDisabled = (leaderboard: Leaderboard, isAdmin = false): boolean => {
  if (leaderboard.isLive) {
    return leaderboard.liveEventStatus === LiveEventStatus.IN_PROGRESS;
  }

  // Admins may delete an active community race; non-admins cannot.
  if (isActiveRace(leaderboard)) return !isAdmin;

  return false;
};

/** Returns true when the edit button should be disabled. */
export const isEditDisabled = (leaderboard: Leaderboard, isAdmin = false): boolean => {
  if (leaderboard.isLive) {
    return leaderboard.liveEventStatus !== LiveEventStatus.SCHEDULED;
  }

  // Admins may edit an active community race (within the backend allowlist).
  if (isActiveRace(leaderboard)) return !isAdmin;

  // Race has not started yet — anyone can edit.
  if (new Date() < leaderboard.openTime) return false;

  // Race is closed — no edits.
  return true;
};

/**
 * Returns true when the enter race button should be disabled.
 * Before liveEventTime, submissions are always accepted.
 * After liveEventTime, submissions are rejected unless submissionPeriodOpen is true.
 */
export const isEnterRaceDisabled = (leaderboard: Leaderboard, submissionPeriodOpen?: boolean): boolean => {
  if (!leaderboard.isLive) {
    return new Date() >= leaderboard.closeTime || new Date() < leaderboard.openTime;
  }
  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    return true;
  }
  if (leaderboard.liveEventTime && new Date() >= leaderboard.liveEventTime) {
    return !submissionPeriodOpen;
  }
  return false;
};
