// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Leaderboard } from '@deepracer-indy/typescript-client';
import { describe, it, expect } from 'vitest';

import { render, screen } from '#utils/testUtils';

import RaceDetailsColumn from '../RaceDetailsColumn';

const baseLb: Partial<Leaderboard> = {
  leaderboardId: 'lb-1',
  name: 'Test Race',
  openTime: new Date('2026-01-01'),
  closeTime: new Date('2026-12-31'),
  raceType: 'TIME_TRIAL',
  isLive: false,
  maxSubmissionsPerUser: 5,
  timingMethod: 'BEST_LAP_TIME',
  participantCount: 0,
};

describe('<RaceDetailsColumn />', () => {
  it('renders race dates for community races', () => {
    render(<RaceDetailsColumn leaderboard={baseLb as Leaderboard} />);

    expect(screen.getByText(/Race dates/)).toBeInTheDocument();
  });

  it('renders live event time for live races with liveEventTime', () => {
    const liveLb = {
      ...baseLb,
      isLive: true,
      liveEventTime: new Date('2026-05-08T14:00:00Z'),
      liveEventStatus: 'IN_PROGRESS',
    };
    render(<RaceDetailsColumn leaderboard={liveLb as Leaderboard} />);

    expect(screen.getByText(/Live event time/)).toBeInTheDocument();
    expect(screen.getByText(/Status/)).toBeInTheDocument();
  });

  it('renders dash when live race has no liveEventTime', () => {
    const liveLb = { ...baseLb, isLive: true, liveEventTime: undefined, liveEventStatus: 'SCHEDULED' };
    render(<RaceDetailsColumn leaderboard={liveLb as Leaderboard} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders status for live races', () => {
    const liveLb = { ...baseLb, isLive: true, liveEventTime: new Date(), liveEventStatus: 'COMPLETED' };
    render(<RaceDetailsColumn leaderboard={liveLb as Leaderboard} />);

    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });
});
