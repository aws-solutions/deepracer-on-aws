// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  LeaderboardDefinition,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import {
  buildActiveRaceEditDefinition,
  buildEditSubmissionDefinition,
  buildLeaderboardDefinition,
} from '../buildLeaderboardDefinition';
import { CreateRaceFormValues } from '../CreateRace';

const baseFormValues: CreateRaceFormValues = {
  raceName: 'Test Race',
  raceType: RaceType.TIME_TRIAL,
  startDate: '2026-05-01',
  endDate: '2026-05-02',
  startTime: '10:00',
  endTime: '18:00',
  track: { trackId: TrackId.A_TO_Z_SPEEDWAY, trackDirection: TrackDirection.COUNTER_CLOCKWISE },
  desc: '',
  ranking: TimingMethod.TOTAL_TIME,
  minLap: '3',
  maxLap: '5',
  offTrackPenalty: '1',
  collisionPenalty: '1',
  maxSubmissionsPerUser: 99,
  objectAvoidanceConfig: { numberOfObjects: 2, objectPositions: [] },
  randomizeObstacles: false,
  isLive: false,
  liveEventDate: '',
  liveEventTime: '',
  maxResets: 3,
};

describe('buildLeaderboardDefinition', () => {
  it('builds community race definition with start/end dates', () => {
    const result = buildLeaderboardDefinition(baseFormValues);

    expect(result.name).toBe('Test Race');
    expect(result.isLive).toBeUndefined();
    expect(result.liveEventTime).toBeUndefined();
    expect(result.maxResets).toBeUndefined();
  });

  it('builds live race definition with liveEventTime and maxResets', () => {
    const result = buildLeaderboardDefinition({
      ...baseFormValues,
      isLive: true,
      liveEventDate: '2026-06-01',
      liveEventTime: '14:00',
      maxResets: 5,
    });

    expect(result.isLive).toBe(true);
    expect(result.liveEventTime).toEqual(new Date(2026, 5, 1, 14, 0));
    expect(result.maxResets).toBe(5);
  });

  it('sets openTime to now for live races', () => {
    const before = new Date();
    const result = buildLeaderboardDefinition({
      ...baseFormValues,
      isLive: true,
      liveEventDate: '2026-06-01',
      liveEventTime: '14:00',
      maxResets: 3,
    });
    const after = new Date();

    expect(result.openTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.openTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('sets closeTime to liveEventTime for live races', () => {
    const result = buildLeaderboardDefinition({
      ...baseFormValues,
      isLive: true,
      liveEventDate: '2026-06-01',
      liveEventTime: '14:00',
      maxResets: 3,
    });

    expect(result.closeTime).toEqual(new Date(2026, 5, 1, 14, 0));
  });

  it('uses maxLap from form values instead of hardcoded 5', () => {
    const result = buildLeaderboardDefinition({ ...baseFormValues, maxLap: '10' });

    expect(result.submissionTerminationConditions.maximumLaps).toBe(10);
    expect(result.submissionTerminationConditions.minimumLaps).toBe(3);
  });
});

describe('buildActiveRaceEditDefinition', () => {
  const originalLeaderboard = {
    name: 'Original Race',
    description: 'original desc',
    openTime: new Date('2026-01-01T10:00:00.000Z'),
    closeTime: new Date('2026-01-02T10:00:00.000Z'),
    trackConfig: { trackId: TrackId.A_TO_Z_SPEEDWAY, trackDirection: TrackDirection.COUNTER_CLOCKWISE },
    raceType: RaceType.TIME_TRIAL,
    maxSubmissionsPerUser: 5,
    resettingBehaviorConfig: { continuousLap: true, offTrackPenaltySeconds: 2, collisionPenaltySeconds: 2 },
    submissionTerminationConditions: { minimumLaps: 2, maximumLaps: 4 },
    timingMethod: TimingMethod.BEST_LAP_TIME,
  };

  it('overrides only closeTime and maxSubmissionsPerUser', () => {
    const newCloseTime = new Date('2099-01-01T00:00:00.000Z');
    const result = buildActiveRaceEditDefinition(originalLeaderboard, {
      closeTime: newCloseTime,
      maxSubmissionsPerUser: 20,
    });

    expect(result.closeTime).toBe(newCloseTime);
    expect(result.maxSubmissionsPerUser).toBe(20);
  });

  it('carries every other field through unchanged from the original leaderboard', () => {
    const result = buildActiveRaceEditDefinition(originalLeaderboard, {
      closeTime: new Date('2099-01-01T00:00:00.000Z'),
      maxSubmissionsPerUser: 20,
    });

    expect(result.name).toBe(originalLeaderboard.name);
    expect(result.description).toBe(originalLeaderboard.description);
    expect(result.openTime).toBe(originalLeaderboard.openTime);
    expect(result.raceType).toBe(originalLeaderboard.raceType);
    expect(result.trackConfig).toEqual(originalLeaderboard.trackConfig);
    expect(result.timingMethod).toBe(originalLeaderboard.timingMethod);
    expect(result.resettingBehaviorConfig).toEqual(originalLeaderboard.resettingBehaviorConfig);
    expect(result.submissionTerminationConditions).toEqual(originalLeaderboard.submissionTerminationConditions);
  });

  it('ignores extra fields on a full LeaderboardDefinition passed as editedFields (e.g. currentLeaderboardValues at the call site)', () => {
    // TypeScript's Pick<...> only enforces excess-property checks on object literals — a
    // non-literal full LeaderboardDefinition (as CreateRace.tsx actually passes) would
    // silently spread every field if this function ever spread `editedFields` directly
    // instead of picking each permitted field explicitly.
    const fullDefinitionWithDifferentValues: LeaderboardDefinition = {
      ...originalLeaderboard,
      description: 'a different description entirely',
      closeTime: new Date('2099-01-01T00:00:00.000Z'),
      maxSubmissionsPerUser: 20,
      openTime: new Date('2030-06-15T08:00:00.000Z'),
      raceType: RaceType.OBJECT_AVOIDANCE,
      trackConfig: { trackId: TrackId.ACE_SPEEDWAY, trackDirection: TrackDirection.CLOCKWISE },
      timingMethod: TimingMethod.TOTAL_TIME,
    };

    const result = buildActiveRaceEditDefinition(originalLeaderboard, fullDefinitionWithDifferentValues);

    expect(result.description).toBe(originalLeaderboard.description);
    expect(result.openTime).toBe(originalLeaderboard.openTime);
    expect(result.raceType).toBe(originalLeaderboard.raceType);
    expect(result.trackConfig).toEqual(originalLeaderboard.trackConfig);
    expect(result.timingMethod).toBe(originalLeaderboard.timingMethod);
  });
});

describe('buildEditSubmissionDefinition', () => {
  const originalLeaderboard: LeaderboardDefinition = {
    name: 'Original Race',
    openTime: new Date('2026-01-01T10:00:00.000Z'),
    closeTime: new Date('2026-01-02T10:00:00.000Z'),
    trackConfig: { trackId: TrackId.A_TO_Z_SPEEDWAY, trackDirection: TrackDirection.COUNTER_CLOCKWISE },
    raceType: RaceType.TIME_TRIAL,
    maxSubmissionsPerUser: 5,
    resettingBehaviorConfig: { continuousLap: true, offTrackPenaltySeconds: 2, collisionPenaltySeconds: 2 },
    submissionTerminationConditions: { minimumLaps: 2, maximumLaps: 4 },
    timingMethod: TimingMethod.BEST_LAP_TIME,
  };

  const formReconstructedValues: LeaderboardDefinition = {
    ...originalLeaderboard,
    name: 'Renamed via form',
    raceType: RaceType.OBJECT_AVOIDANCE,
    closeTime: new Date('2099-01-01T00:00:00.000Z'),
    maxSubmissionsPerUser: 20,
  };

  it('builds from the original leaderboard (via buildActiveRaceEditDefinition) for an active-race admin edit', () => {
    const result = buildEditSubmissionDefinition(true, originalLeaderboard, formReconstructedValues);

    // Only closeTime/maxSubmissionsPerUser come from the form — everything else must be
    // carried through unchanged from the original, not the form-reconstructed definition.
    expect(result.name).toBe(originalLeaderboard.name);
    expect(result.raceType).toBe(originalLeaderboard.raceType);
    expect(result.closeTime).toBe(formReconstructedValues.closeTime);
    expect(result.maxSubmissionsPerUser).toBe(formReconstructedValues.maxSubmissionsPerUser);
  });

  it('uses the form-reconstructed definition as-is when not an active-race admin edit', () => {
    const result = buildEditSubmissionDefinition(false, originalLeaderboard, formReconstructedValues);

    expect(result).toBe(formReconstructedValues);
  });

  it('uses the form-reconstructed definition as-is when isActiveRaceAdminEdit is true but no original leaderboard is available', () => {
    const result = buildEditSubmissionDefinition(true, undefined, formReconstructedValues);

    expect(result).toBe(formReconstructedValues);
  });
});
