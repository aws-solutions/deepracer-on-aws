// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Leaderboard, LiveEventStatus } from '@deepracer-indy/typescript-client';

/** Returns true when the delete button should be disabled. */
export const isDeleteDisabled = (leaderboard: Leaderboard): boolean =>
  leaderboard.isLive
    ? leaderboard.liveEventStatus === LiveEventStatus.IN_PROGRESS
    : new Date() >= leaderboard.openTime && new Date() < leaderboard.closeTime;

/** Returns true when the edit button should be disabled. */
export const isEditDisabled = (leaderboard: Leaderboard): boolean =>
  leaderboard.isLive ? leaderboard.liveEventStatus !== LiveEventStatus.SCHEDULED : new Date() >= leaderboard.openTime;

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
