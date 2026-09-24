// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  EventStatus,
  Leaderboard,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import Leaderboards from './Leaderboards';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const track: Leaderboard = {
  leaderboardId: 'lb-001',
  name: 'Qualifying',
  openTime: new Date('2026-01-01'),
  closeTime: new Date('2026-01-02'),
  trackConfig: { trackId: TrackId.AWS_SUMMIT_RACEWAY, trackDirection: TrackDirection.CLOCKWISE },
  raceType: RaceType.TIME_TRIAL,
  maxSubmissionsPerUser: 0,
  timingMethod: TimingMethod.BEST_LAP_TIME,
  resettingBehaviorConfig: { continuousLap: true },
  submissionTerminationConditions: { minimumLaps: 1, maximumLaps: 5 },
  participantCount: 0,
  trackType: TrackId.AWS_SUMMIT_RACEWAY,
  fleetId: 'fleet-001',
  leaderBoardFooter: 'Have fun racing!',
};

describe('<Leaderboards />', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('renders the readonly leaderboard table with the requested columns and values', () => {
    render(<Leaderboards eventId="evt-001" tracks={[track]} eventStatus={EventStatus.IN_PROGRESS} />);

    expect(screen.getByText(i18n.t('events:detail.leaderboards.header'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('events:detail.leaderboards.columnHeaders.track'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('events:detail.leaderboards.columnHeaders.fleet'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('events:detail.leaderboards.columnHeaders.headerText'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('events:detail.leaderboards.columnHeaders.footerText'))).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('fleet-001')).toBeInTheDocument();
    expect(screen.getByText('Qualifying')).toBeInTheDocument();
    expect(screen.getByText('Have fun racing!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('events:detail.tracks.table.timekeepLink') })).toHaveAttribute(
      'href',
      '/timekeep',
    );
  });

  it('persists the Event and Track before navigating to the new Timekeeping page', () => {
    render(<Leaderboards eventId="evt-001" tracks={[track]} eventStatus={EventStatus.IN_PROGRESS} />);

    const link = screen.getByRole('link', { name: i18n.t('events:detail.tracks.table.timekeepLink') });
    fireEvent.click(link);

    expect(mockNavigate).toHaveBeenCalledWith('/timekeep');
    expect(JSON.parse(localStorage.getItem('deepracer-timekeeping-selected-event-and-track') ?? '')).toEqual({
      selectedEventId: 'evt-001',
      selectedLeaderboardId: 'lb-001',
    });
  });

  it('renders a placeholder for optional values that are not configured', () => {
    render(
      <Leaderboards
        eventId="evt-001"
        tracks={[{ ...track, fleetId: undefined, leaderBoardFooter: undefined }]}
        eventStatus={EventStatus.DRAFT}
      />,
    );

    expect(screen.getAllByText('-')).toHaveLength(2);
  });
});
