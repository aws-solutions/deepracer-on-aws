// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { render } from '#utils/testUtils';

import RaceStats from '../index';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseGetRaceStatsQuery = vi.fn();

vi.mock('#services/deepRacer/raceManagementApi', () => ({
  useGetRaceStatsQuery: (...args: unknown[]) => mockUseGetRaceStatsQuery(...args),
}));

vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    apiEndpointUrl: 'https://api.example.com',
    userPoolId: 'us-east-1_test',
    userPoolClientId: 'testclient',
    identityPoolId: 'us-east-1:test-pool',
    region: 'us-east-1',
    uploadBucketName: 'test-bucket',
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_STATS = {
  totalEvents: 5,
  totalRacers: 42,
  totalRaces: 120,
  totalLaps: 500,
  totalValidLaps: 450,
  averageLapTimeMilliseconds: 48_500,
  fastestLapsEver: [
    { participantName: 'Alice Chen', lapTimeMilliseconds: 43_210, eventId: 'evt-1', eventName: 'Summer Slam' },
    { participantName: 'Bob Santos', lapTimeMilliseconds: 44_500, eventId: 'evt-1', eventName: 'Summer Slam' },
    { participantName: 'Carol Kim', lapTimeMilliseconds: 45_100, eventId: 'evt-2', eventName: 'Winter Cup' },
  ],
  totalCountries: 3,
  eventsByCountry: [
    { countryCode: 'US', events: 3, races: 80, laps: 300 },
    { countryCode: 'GB', events: 1, races: 20, laps: 80 },
    { countryCode: 'DE', events: 1, races: 20, laps: 120 },
  ],
  eventsByMonth: [
    { month: '2026-07', events: 2, races: 50, laps: 200 },
    { month: '2026-08', events: 3, races: 70, laps: 300 },
  ],
  eventTypeBreakdown: [
    { typeOfEvent: 'AWS_SUMMIT', count: 3 },
    { typeOfEvent: 'OFFICIAL_TRACK_RACE', count: 2 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPage = () =>
  render(<RaceStats />, {
    componentRoute: '/race-management/stats',
    initialRouteEntries: ['/race-management/stats'],
  });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<RaceStats />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders without crashing while loading', () => {
      mockUseGetRaceStatsQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });
      renderPage();
      expect(screen.getByText('Race statistics')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error alert on API error', () => {
      mockUseGetRaceStatsQuery.mockReturnValue({ isLoading: false, isError: true, data: undefined });
      renderPage();
      expect(screen.getByText('Failed to load race statistics')).toBeInTheDocument();
    });

    it('shows no statistics message when data is null', () => {
      mockUseGetRaceStatsQuery.mockReturnValue({ isLoading: false, isError: false, data: null });
      renderPage();
      expect(
        screen.getByText('No statistics available yet. Statistics are computed after each race submission.'),
      ).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockUseGetRaceStatsQuery.mockReturnValue({ isLoading: false, isError: false, data: MOCK_STATS });
    });

    it('renders page header', () => {
      renderPage();
      expect(screen.getByText('Race statistics')).toBeInTheDocument();
    });

    describe('Summary KPI cards', () => {
      it('shows total events', () => {
        renderPage();
        expect(screen.getByText('Total events')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });

      it('shows total racers', () => {
        renderPage();
        expect(screen.getByText('Total racers')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
      });

      it('shows total races', () => {
        renderPage();
        expect(screen.getByText('Total races')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
      });

      it('shows valid laps', () => {
        renderPage();
        expect(screen.getByText('Valid laps')).toBeInTheDocument();
        expect(screen.getByText('450')).toBeInTheDocument();
      });

      it('shows completion rate derived from valid/total laps', () => {
        renderPage();
        expect(screen.getByText('Completion rate')).toBeInTheDocument();
        // 450/500 = 90%
        expect(screen.getByText('90%')).toBeInTheDocument();
      });
    });

    describe('Performance KPI cards', () => {
      it('shows average lap time', () => {
        renderPage();
        expect(screen.getByText('Average lap time')).toBeInTheDocument();
        expect(screen.getByText('48.500s')).toBeInTheDocument();
      });

      it('shows fastest lap ever with racer name', () => {
        renderPage();
        expect(screen.getByText('Fastest lap ever')).toBeInTheDocument();
        // 43.210s may appear in both the KPI card and the fastest laps table
        expect(screen.getAllByText('43.210s').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Alice Chen').length).toBeGreaterThan(0);
      });
    });

    describe('Fastest laps table', () => {
      it('renders fastest laps table header', () => {
        renderPage();
        expect(screen.getByText('Fastest laps ever')).toBeInTheDocument();
      });

      it('shows all fastest lap entries', () => {
        renderPage();
        expect(screen.getByText('Bob Santos')).toBeInTheDocument();
        expect(screen.getByText('Carol Kim')).toBeInTheDocument();
      });

      it('shows the event name rather than the raw event ID', () => {
        renderPage();
        expect(screen.getByText('Winter Cup')).toBeInTheDocument();
        expect(screen.getAllByText('Summer Slam').length).toBeGreaterThan(0);
        expect(screen.queryByText('evt-1')).not.toBeInTheDocument();
      });

      it('shows lap times in table', () => {
        renderPage();
        expect(screen.getByText('44.500s')).toBeInTheDocument();
        expect(screen.getByText('45.100s')).toBeInTheDocument();
      });

      it('shows medal for first place', () => {
        renderPage();
        expect(screen.getByText('🥇')).toBeInTheDocument();
      });

      it('shows medals for top 3', () => {
        renderPage();
        expect(screen.getByText('🥈')).toBeInTheDocument();
        expect(screen.getByText('🥉')).toBeInTheDocument();
      });

      it('shows counter on fastest laps header', () => {
        renderPage();
        expect(screen.getByText('(3)')).toBeInTheDocument();
      });
    });

    describe('zero valid laps edge case', () => {
      it('shows 0% completion rate when no valid laps', () => {
        mockUseGetRaceStatsQuery.mockReturnValue({
          isLoading: false,
          isError: false,
          data: { ...MOCK_STATS, totalValidLaps: 0 },
        });
        renderPage();
        expect(screen.getByText('0%')).toBeInTheDocument();
      });

      it('shows — for average lap time when zero', () => {
        mockUseGetRaceStatsQuery.mockReturnValue({
          isLoading: false,
          isError: false,
          data: { ...MOCK_STATS, averageLapTimeMilliseconds: 0 },
        });
        renderPage();
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
      });
    });

    describe('Countries and aggregation fields', () => {
      beforeEach(() => {
        mockUseGetRaceStatsQuery.mockReturnValue({ isLoading: false, isError: false, data: MOCK_STATS });
      });

      it('shows totalCountries KPI card', () => {
        renderPage();
        expect(screen.getByText('Countries')).toBeInTheDocument();
        // '3' may also appear in chart axis labels — check KPI label is present
        expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      });

      it('shows Events by country section header when data exists', () => {
        renderPage();
        expect(screen.getByText('Events by country')).toBeInTheDocument();
      });

      it('shows Activity over time section header when data exists', () => {
        renderPage();
        expect(screen.getByText('Activity over time')).toBeInTheDocument();
      });

      it('shows Event type breakdown section header when data exists', () => {
        renderPage();
        // Cloudscape PieChart also renders title in a <desc> — use getAllByText
        expect(screen.getAllByText('Event type breakdown').length).toBeGreaterThan(0);
      });

      it('does not show chart sections when data arrays are empty', () => {
        mockUseGetRaceStatsQuery.mockReturnValue({
          isLoading: false,
          isError: false,
          data: { ...MOCK_STATS, eventsByCountry: [], eventsByMonth: [], eventTypeBreakdown: [] },
        });
        renderPage();
        expect(screen.queryByText('Events by country')).not.toBeInTheDocument();
        expect(screen.queryByText('Activity over time')).not.toBeInTheDocument();
        expect(screen.queryByText('Event type breakdown')).not.toBeInTheDocument();
      });
    });
  });
});
