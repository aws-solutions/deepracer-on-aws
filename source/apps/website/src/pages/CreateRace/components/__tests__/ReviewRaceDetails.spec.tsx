// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RaceType, TimingMethod, TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '../../../../utils/testUtils.js';
import ReviewRaceDetails from '../ReviewRaceDetails';

vi.mock('#components/RaceOverview/components/RaceDetailsColumn', () => ({
  default: () => <div data-testid="race-details-column" />,
}));
vi.mock('#components/RaceOverview/components/RaceTrackColumn', () => ({
  default: () => <div data-testid="race-track-column" />,
}));
vi.mock('#components/RaceOverview/components/RaceRulesColumn', () => ({
  default: () => <div data-testid="race-rules-column" />,
}));

const baseLeaderboardDef = {
  name: 'Test Race',
  openTime: new Date('2026-04-01T10:00:00Z'),
  closeTime: new Date('2026-04-02T10:00:00Z'),
  trackConfig: { trackId: TrackId.A_TO_Z_SPEEDWAY, trackDirection: TrackDirection.COUNTER_CLOCKWISE },
  raceType: RaceType.TIME_TRIAL,
  maxSubmissionsPerUser: 99,
  resettingBehaviorConfig: { continuousLap: true },
  submissionTerminationConditions: { minimumLaps: 3, maximumLaps: 5 },
  timingMethod: TimingMethod.TOTAL_TIME,
};

describe('<ReviewRaceDetails />', () => {
  it('renders race overview columns', () => {
    render(<ReviewRaceDetails leaderboardDef={baseLeaderboardDef} setActiveStepIndex={vi.fn()} />);

    expect(screen.getByTestId('race-details-column')).toBeInTheDocument();
    expect(screen.getByTestId('race-track-column')).toBeInTheDocument();
    expect(screen.getByTestId('race-rules-column')).toBeInTheDocument();
  });
});
