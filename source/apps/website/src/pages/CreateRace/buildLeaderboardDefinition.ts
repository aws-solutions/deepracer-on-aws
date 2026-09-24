// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LeaderboardDefinition, RaceType } from '@deepracer-indy/typescript-client';

import { CreateRaceFormValues } from './CreateRace';
import { parseDateTimeLocal } from './validation';

/** Builds a LeaderboardDefinition from form values. */
export const buildLeaderboardDefinition = (data: CreateRaceFormValues): LeaderboardDefinition => {
  const liveEventTime =
    data.isLive && data.liveEventDate && data.liveEventTime
      ? parseDateTimeLocal(data.liveEventDate, data.liveEventTime)
      : undefined;

  return {
    name: data.raceName,
    openTime: data.isLive ? new Date() : new Date(data.startDate + ' ' + data.startTime),
    closeTime: data.isLive && liveEventTime ? liveEventTime : new Date(data.endDate + ' ' + data.endTime),
    trackConfig: data.track,
    raceType: data.raceType,
    maxSubmissionsPerUser: data.maxSubmissionsPerUser,
    resettingBehaviorConfig: {
      continuousLap: true,
      offTrackPenaltySeconds: Number(data.offTrackPenalty),
      collisionPenaltySeconds: Number(data.collisionPenalty),
    },
    submissionTerminationConditions: {
      minimumLaps: Number(data.minLap),
      maximumLaps: Number(data.maxLap),
    },
    timingMethod: data.ranking,
    description: data.desc || undefined,
    objectAvoidanceConfig:
      data.raceType === RaceType.OBJECT_AVOIDANCE
        ? {
            numberOfObjects: data.objectAvoidanceConfig.numberOfObjects,
            objectPositions: data.randomizeObstacles ? undefined : data.objectAvoidanceConfig.objectPositions,
          }
        : undefined,
    isLive: data.isLive || undefined,
    liveEventTime,
    maxResets: data.isLive ? data.maxResets : undefined,
  };
};

/**
 * Builds the LeaderboardDefinition to submit when an admin edits an already-open community
 * race. Per EditLeaderboard's server-side allowlist (editLeaderboard.ts's
 * handleActiveRaceEdit), only closeTime and maxSubmissionsPerUser may change — every other
 * field is carried through unchanged from the original leaderboard rather than the
 * freshly-built definition, since reconstructing openTime/etc. from the form's
 * minute-precision date/time strings would not exactly match the stored value and fail the
 * server's unchanged-fields check.
 */
export const buildActiveRaceEditDefinition = (
  originalLeaderboard: LeaderboardDefinition,
  editedFields: Pick<LeaderboardDefinition, 'closeTime' | 'maxSubmissionsPerUser'>,
): LeaderboardDefinition => ({
  ...originalLeaderboard,
  closeTime: editedFields.closeTime,
  maxSubmissionsPerUser: editedFields.maxSubmissionsPerUser,
});

/**
 * Selects the LeaderboardDefinition to submit for an edit. For an active-race admin edit,
 * this must be built from the original stored leaderboard (see buildActiveRaceEditDefinition)
 * rather than the form-reconstructed definition — otherwise the server's unchanged-fields
 * check rejects the edit. For every other edit, the form-reconstructed definition is used
 * as-is.
 */
export const buildEditSubmissionDefinition = (
  isActiveRaceAdminEdit: boolean,
  originalLeaderboard: LeaderboardDefinition | undefined,
  currentLeaderboardValues: LeaderboardDefinition,
): LeaderboardDefinition =>
  isActiveRaceAdminEdit && originalLeaderboard
    ? buildActiveRaceEditDefinition(originalLeaderboard, currentLeaderboardValues)
    : currentLeaderboardValues;
