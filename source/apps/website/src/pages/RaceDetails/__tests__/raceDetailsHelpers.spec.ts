// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Leaderboard,
  LiveEventStatus,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { isDeleteDisabled, isEditDisabled, isEnterRaceDisabled } from '../raceDetailsHelpers';

const baseLeaderboard: Leaderboard = {
  leaderboardId: 'lb-1',
  name: 'Test Race',
  openTime: new Date('2020-01-01'),
  closeTime: new Date('2099-01-01'),
  trackConfig: { trackId: TrackId.A_TO_Z_SPEEDWAY, trackDirection: TrackDirection.COUNTER_CLOCKWISE },
  raceType: RaceType.TIME_TRIAL,
  maxSubmissionsPerUser: 99,
  resettingBehaviorConfig: { continuousLap: true },
  submissionTerminationConditions: { minimumLaps: 3, maximumLaps: 5 },
  timingMethod: TimingMethod.TOTAL_TIME,
  participantCount: 0,
};

describe('raceDetailsHelpers', () => {
  describe('isDeleteDisabled', () => {
    it('disables delete for live race when IN_PROGRESS', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.IN_PROGRESS };
      expect(isDeleteDisabled(lb)).toBe(true);
    });

    it('enables delete for live race when SCHEDULED', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.SCHEDULED };
      expect(isDeleteDisabled(lb)).toBe(false);
    });

    it('enables delete for live race when COMPLETED', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.COMPLETED };
      expect(isDeleteDisabled(lb)).toBe(false);
    });

    it('disables delete for community race when active', () => {
      const lb = { ...baseLeaderboard, openTime: new Date('2020-01-01'), closeTime: new Date('2099-01-01') };
      expect(isDeleteDisabled(lb)).toBe(true);
    });
  });

  describe('isEditDisabled', () => {
    it('enables edit for live race when SCHEDULED', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.SCHEDULED };
      expect(isEditDisabled(lb)).toBe(false);
    });

    it('disables edit for live race when IN_PROGRESS', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.IN_PROGRESS };
      expect(isEditDisabled(lb)).toBe(true);
    });

    it('disables edit for live race when COMPLETED', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.COMPLETED };
      expect(isEditDisabled(lb)).toBe(true);
    });
  });

  describe('isEnterRaceDisabled', () => {
    it('disables enter for live race when COMPLETED', () => {
      const lb = { ...baseLeaderboard, isLive: true, liveEventStatus: LiveEventStatus.COMPLETED };
      expect(isEnterRaceDisabled(lb)).toBe(true);
    });

    it('disables enter for live race when past liveEventTime', () => {
      const lb = {
        ...baseLeaderboard,
        isLive: true,
        liveEventStatus: LiveEventStatus.IN_PROGRESS,
        liveEventTime: new Date('2020-01-01'),
      };
      expect(isEnterRaceDisabled(lb)).toBe(true);
    });

    it('enables enter for live race when past liveEventTime but submissionPeriodOpen', () => {
      const lb = {
        ...baseLeaderboard,
        isLive: true,
        liveEventStatus: LiveEventStatus.IN_PROGRESS,
        liveEventTime: new Date('2020-01-01'),
      };
      expect(isEnterRaceDisabled(lb, true)).toBe(false);
    });

    it('enables enter for live race when IN_PROGRESS without liveEventTime', () => {
      const lb = {
        ...baseLeaderboard,
        isLive: true,
        liveEventStatus: LiveEventStatus.IN_PROGRESS,
      };
      expect(isEnterRaceDisabled(lb)).toBe(false);
    });

    it('enables enter for live race when IN_PROGRESS and before liveEventTime', () => {
      const lb = {
        ...baseLeaderboard,
        isLive: true,
        liveEventStatus: LiveEventStatus.IN_PROGRESS,
        liveEventTime: new Date('2099-01-01'),
      };
      expect(isEnterRaceDisabled(lb)).toBe(false);
    });

    it('enables enter for live race when SCHEDULED and before liveEventTime', () => {
      const lb = {
        ...baseLeaderboard,
        isLive: true,
        liveEventStatus: LiveEventStatus.SCHEDULED,
        liveEventTime: new Date('2099-01-01'),
      };
      expect(isEnterRaceDisabled(lb)).toBe(false);
    });

    it('disables enter for community race before open', () => {
      const lb = { ...baseLeaderboard, openTime: new Date('2099-01-01'), closeTime: new Date('2099-02-01') };
      expect(isEnterRaceDisabled(lb)).toBe(true);
    });

    it('enables enter for community race while open', () => {
      const lb = { ...baseLeaderboard, openTime: new Date('2020-01-01'), closeTime: new Date('2099-01-01') };
      expect(isEnterRaceDisabled(lb)).toBe(false);
    });

    it('disables enter for community race after close', () => {
      const lb = { ...baseLeaderboard, openTime: new Date('2020-01-01'), closeTime: new Date('2020-02-01') };
      expect(isEnterRaceDisabled(lb)).toBe(true);
    });
  });
});
