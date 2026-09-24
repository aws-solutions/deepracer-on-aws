// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageId, pages } from '#constants/pages.js';
import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import TopNavigation from './TopNavigation';

const events = [
  { eventId: 'event-1', name: 'AWS Paris Summit 2023' },
  { eventId: 'event-2', name: 'AWS re:Invent 2023' },
];
const tracks = [
  { leaderboardId: 'track-1', name: 'Paris AWS Summit' },
  { leaderboardId: 'track-2', name: 're:Invent Track' },
];

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useGetProfileQuery: () => ({ currentData: undefined }),
}));

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useListEventsQuery: () => ({ data: events }),
  useListEventTracksQuery: () => ({ data: tracks }),
}));

vi.mock('#utils/authUtils.js', () => ({
  getUserEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('<TopNavigation />', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not show Timekeeping context utilities on non-Timekeeping pages', () => {
    render(<TopNavigation />, { componentRoute: pages[PageId.HOME].path });

    expect(screen.queryByRole('button', { name: i18n.t('common:topNavigation.selectEvent') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('common:topNavigation.selectTrack') })).not.toBeInTheDocument();
  });

  it('shows separate Event and Track utilities on the Timekeeping page', () => {
    render(<TopNavigation />, { componentRoute: pages[PageId.TIMEKEEPING].path });

    expect(screen.getByRole('button', { name: i18n.t('common:topNavigation.selectEvent') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('common:topNavigation.selectTrack') })).toBeInTheDocument();
  });

  it('shows persisted Event and Track names in the Timekeeping utilities', () => {
    localStorage.setItem(
      'deepracer-timekeeping-selected-event-and-track',
      JSON.stringify({ selectedEventId: 'event-1', selectedLeaderboardId: 'track-1' }),
    );

    render(<TopNavigation />, { componentRoute: pages[PageId.TIMEKEEPING].path });

    expect(screen.getByRole('button', { name: 'AWS Paris Summit 2023' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paris AWS Summit' })).toBeInTheDocument();
  });

  it('opens the select Event and Track modal when either context utility is clicked', () => {
    render(<TopNavigation />, { componentRoute: pages[PageId.TIMEKEEPING].path });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('common:topNavigation.selectEvent') }));

    expect(screen.getByTestId('select-event-and-track-modal-event-select')).toBeInTheDocument();
  });
});
