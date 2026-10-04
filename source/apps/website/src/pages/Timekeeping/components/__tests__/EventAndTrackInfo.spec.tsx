// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus, RaceFormat } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import { EventAndTrackInfo } from '../EventAndTrackInfo';

const mockListEventsQuery = vi.fn();
const mockListEventTracksQuery = vi.fn();
const mockSetFetchCarLogsOnRunFinish = vi.fn();

vi.mock('#hooks/useTimekeepingContext.js', () => ({
  useTimekeepingContext: () => ({
    fetchCarLogsOnRunFinish: false,
    selectedEventId: 'event-001',
    selectedLeaderboardId: 'leaderboard-001',
    setFetchCarLogsOnRunFinish: mockSetFetchCarLogsOnRunFinish,
  }),
}));

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useListEventsQuery: (...args: unknown[]) => mockListEventsQuery(...args),
  useListEventTracksQuery: (...args: unknown[]) => mockListEventTracksQuery(...args),
}));

describe('<EventAndTrackInfo />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEventsQuery.mockReturnValue({
      data: [{ eventId: 'event-001', name: 'Average laps event', raceFormat: RaceFormat.AVERAGE_LAPS }],
    });
    mockListEventTracksQuery.mockReturnValue({
      data: [{ leaderboardId: 'leaderboard-001', fleetId: 'fleet-001', name: 'Main track' }],
    });
  });

  it('renders the selected event race format for the selected track', () => {
    render(<EventAndTrackInfo />);

    expect(mockListEventsQuery).toHaveBeenCalledWith({ status: EventStatus.IN_PROGRESS });
    expect(mockListEventTracksQuery).toHaveBeenCalledWith({ eventId: 'event-001' }, { skip: false });
    expect(screen.getByTestId('race-format-info')).toHaveTextContent(
      `${i18n.t('timekeeping:contextSelection.raceFormatLabel')} ${i18n.t('events:raceFormat.AVERAGE_LAPS')}`,
    );
    expect(screen.getByTestId('race-format-info')).not.toHaveTextContent(i18n.t('events:raceFormat.BEST_LAP'));
  });

  it('persists the fetch-car-logs toggle through the timekeeping context', () => {
    render(<EventAndTrackInfo />);

    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('timekeeping:contextSelection.fetchCarLogsLabel') }));

    expect(mockSetFetchCarLogsOnRunFinish).toHaveBeenCalledWith(true);
  });
});
