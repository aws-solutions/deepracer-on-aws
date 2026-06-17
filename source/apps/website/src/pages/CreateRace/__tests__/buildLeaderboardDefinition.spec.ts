// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RaceType, TimingMethod, TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { buildLeaderboardDefinition } from '../buildLeaderboardDefinition';
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
