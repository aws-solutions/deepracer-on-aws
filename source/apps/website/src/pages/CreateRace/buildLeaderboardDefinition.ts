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
