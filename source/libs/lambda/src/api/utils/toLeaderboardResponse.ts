// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LeaderboardItem } from '@deepracer-indy/database';
import type { Leaderboard } from '@deepracer-indy/typescript-server-client';

/** Maps a LeaderboardItem entity to the Smithy Leaderboard response shape. */
export const toLeaderboardResponse = (item: LeaderboardItem): Leaderboard => ({
  name: item.name,
  openTime: new Date(item.openTime),
  closeTime: new Date(item.closeTime),
  trackConfig: item.trackConfig,
  raceType: item.raceType,
  objectAvoidanceConfig: item.objectAvoidanceConfig,
  resettingBehaviorConfig: item.resettingBehaviorConfig,
  submissionTerminationConditions: {
    maximumLaps: item.submissionTerminationConditions.maxLaps,
    minimumLaps: item.minimumLaps,
    maxTimeInMinutes: item.submissionTerminationConditions.maxTimeInMinutes,
  },
  timingMethod: item.timingMethod,
  maxSubmissionsPerUser: item.maxSubmissionsPerUser,
  leaderboardId: item.leaderboardId,
  participantCount: item.participantCount,
  isLive: item.isLive,
  liveEventTime: item.liveEventTime ? new Date(item.liveEventTime) : undefined,
  liveEventStatus: item.liveEventStatus,
  maxResets: item.maxResets,
});
