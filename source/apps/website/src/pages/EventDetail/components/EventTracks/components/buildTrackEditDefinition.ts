// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Leaderboard, LeaderboardDefinition } from '@deepracer-indy/typescript-client';

/**
 * EditLeaderboard requires the FULL leaderboardDefinition (not a partial patch) — see
 * edit-leaderboard.smithy. This rebuilds that full definition from an existing,
 * already-persisted Leaderboard, applying only the name/leaderBoardFooter/fleetId
 * overrides an operator makes via TrackTabPanel. Every other field (trackConfig,
 * raceType, resettingBehaviorConfig, submissionTerminationConditions, timingMethod,
 * maxSubmissionsPerUser, etc.) is carried through unchanged — these are placeholder
 * values for physical event tracks (see addTrackToEvent.ts) that Event Management
 * itself never reads, but EditLeaderboard still requires them present.
 *
 * `eventId` and `trackType` are deliberately NOT sent: they are server-owned, read-only
 * fields present only on the Leaderboard response shape, not on LeaderboardDefinition.
 * The handler resolves the owning event from the persisted record
 * (`existingLeaderboard.eventId`), so they never need to round-trip through the client.
 */
export const buildTrackEditDefinition = (
  leaderboard: Leaderboard,
  overrides: { name: string; leaderBoardFooter?: string; fleetId?: string },
): LeaderboardDefinition => ({
  name: overrides.name,
  description: leaderboard.description,
  openTime: leaderboard.openTime,
  closeTime: leaderboard.closeTime,
  trackConfig: leaderboard.trackConfig,
  raceType: leaderboard.raceType,
  maxSubmissionsPerUser: leaderboard.maxSubmissionsPerUser,
  objectAvoidanceConfig: leaderboard.objectAvoidanceConfig,
  resettingBehaviorConfig: leaderboard.resettingBehaviorConfig,
  submissionTerminationConditions: leaderboard.submissionTerminationConditions,
  timingMethod: leaderboard.timingMethod,
  liveEventStatus: leaderboard.liveEventStatus,
  isLive: leaderboard.isLive,
  liveEventTime: leaderboard.liveEventTime,
  maxResets: leaderboard.maxResets,
  submissionPeriodOpen: leaderboard.submissionPeriodOpen,
  fleetId: overrides.fleetId,
  leaderBoardFooter: overrides.leaderBoardFooter,
});
