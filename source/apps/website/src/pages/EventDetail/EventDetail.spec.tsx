// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Event,
  EventStatistics as EventStatisticsType,
  EventStatus,
  EventType,
  RaceFormat,
} from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageId } from '#constants/pages';
import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import EventDetail from './EventDetail';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const mockEvent: Event = {
  eventId: 'evt-001',
  name: 're:Invent 2025 Race',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2025-12-01',
  countryCode: 'US',
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: 5,
  maxTimeInMinutes: 3,
  maxResets: 3,
  eventStatus: EventStatus.DRAFT,
  createdBy: 'TestAdmin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockTransitionEventStatus = vi.fn();
const mockGetEventQuery = vi.fn(() => ({ data: mockEvent, isLoading: false }));
const mockGetEventStatisticsQuery = vi.fn<
  () => { data: EventStatisticsType | undefined; isLoading: boolean; isError: boolean; refetch: () => void }
>(() => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }));
const mockAddTrackToEvent = vi.fn(() => ({ unwrap: () => Promise.resolve({ leaderboardId: 'lb-001' }) }));
const mockRemoveTrackFromEvent = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
const mockListEventTracksQuery = vi.fn(() => ({ data: [], isLoading: false }));
const mockGetCombinedLeaderboardQuery = vi.fn(() => ({ data: undefined, isLoading: false, isError: false }));

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useGetEventQuery: () => mockGetEventQuery(),
  useTransitionEventStatusMutation: vi.fn(() => [mockTransitionEventStatus, { isLoading: false }]),
  useGetEventStatisticsQuery: () => mockGetEventStatisticsQuery(),
  useListEventTracksQuery: () => mockListEventTracksQuery(),
  useAddTrackToEventMutation: vi.fn(() => [mockAddTrackToEvent, { isLoading: false }]),
  useRemoveTrackFromEventMutation: vi.fn(() => [mockRemoveTrackFromEvent, { isLoading: false }]),
  useGetCombinedLeaderboardQuery: () => mockGetCombinedLeaderboardQuery(),
}));

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: () => ({ data: [] }),
}));

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useListRunsQuery: vi.fn(() => ({ data: [], isFetching: false, isError: false })),
  useGetRunQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
  useUpdateLapMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useListProfilesQuery: vi.fn(() => ({ data: [] })),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: 'evt-001' }),
  };
});

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<EventDetail />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventQuery.mockReturnValue({ data: mockEvent, isLoading: false });
    mockGetEventStatisticsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockTransitionEventStatus.mockReturnValue({
      unwrap: () => Promise.resolve({ eventId: 'evt-001', status: 'OPEN' }),
    });
  });

  describe('when user is an Admin', () => {
    beforeEach(() => {
      // Both calls resolve to true (isAdmin and isAdminOrFacilitator)
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the event name as the page title', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });
    });

    it('renders the event status indicator', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:status.DRAFT'))).toBeInTheDocument();
      });
    });

    it('renders event detail key-value pairs', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:raceFormat.BEST_LAP'))).toBeInTheDocument();
      });

      expect(screen.getByText('US')).toBeInTheDocument();
    });

    it('shows "Unlimited" for maximum runs per racer when not set', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.fields.maxRunsPerRacer.unlimitedOption'))).toBeInTheDocument();
      });
    });

    it('shows the configured cap for maximum runs per racer when set', async () => {
      mockGetEventQuery.mockReturnValue({ data: { ...mockEvent, maxRunsPerRacer: 7 }, isLoading: false });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText('7')).toBeInTheDocument();
      });
    });

    it('shows "Unlimited" for maximum resets when set to the 9999 sentinel', async () => {
      mockGetEventQuery.mockReturnValue({ data: { ...mockEvent, maxResets: 9999 }, isLoading: false });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('events:form.fields.maxResets.unlimitedOption'))).toHaveLength(2);
      });
      expect(screen.queryByText('9999')).not.toBeInTheDocument();
    });

    it('shows the average lap window when set', async () => {
      mockGetEventQuery.mockReturnValue({ data: { ...mockEvent, maxLaps: 3, averageLapsWindow: 7 }, isLoading: false });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText('7')).toBeInTheDocument();
      });
    });

    it('does not show the average lap window when unset', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.fields.maxResets.label'))).toBeInTheDocument();
      });

      expect(screen.queryByText(i18n.t('events:form.fields.averageLapsWindow.label'))).not.toBeInTheDocument();
    });

    it('renders the sponsor field when present', async () => {
      mockGetEventQuery.mockReturnValue({ data: { ...mockEvent, sponsor: 'AWS' }, isLoading: false });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText('AWS')).toBeInTheDocument();
      });
    });

    it('renders the Tracks, Runs, and Statistics tabs', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: i18n.t('events:detail.tabs.tracks') })).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: i18n.t('events:detail.tabs.runs') })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: i18n.t('events:detail.tabs.statistics') })).toBeInTheDocument();
    });

    it('renders the edit button for admins', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.editEventButton') })).toBeInTheDocument();
      });
    });

    it('navigates to the edit event page when the edit button is clicked', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.editEventButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.editEventButton') }));

      expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.EDIT_EVENT, { eventId: 'evt-001' }));
    });

    it('renders the lifecycle transition button for DRAFT events', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        // DRAFT → OPEN means the button label should be "Publish event"
        expect(
          screen.getByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('when user is a Facilitator (not Admin)', () => {
    beforeEach(() => {
      // First call (isAdmin) → false, second call (isAdminOrFacilitator) → true
      mockCheckUserGroupMembership.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    });

    it('renders the event name without admin action buttons', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('when user is a Racer', () => {
    beforeEach(() => {
      // isAdmin → false, isAdminOrFacilitator → true (Racers pass the combined check)
      mockCheckUserGroupMembership.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    });

    it('renders the event details in read-only mode without any action buttons', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('events:list.editEventButton') })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }),
      ).not.toBeInTheDocument();
    });

    it('still renders the event metadata', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:status.DRAFT'))).toBeInTheDocument();
      });

      expect(screen.getByText('US')).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:raceFormat.BEST_LAP'))).toBeInTheDocument();
    });
  });

  describe('when user is not authorized', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(false);
    });

    it('renders unauthorized message', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:unauthorized.message'))).toBeInTheDocument();
      });
    });
  });

  describe('tabs navigation', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('shows the readonly Leaderboards table on the Tracks tab', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.leaderboards.header'))).toBeInTheDocument();
      });
    });

    it('does not show the combined leaderboard when the event has no combinedScoringStrategy', async () => {
      mockListEventTracksQuery.mockReturnValue({
        data: [
          { leaderboardId: 'lb-001', trackConfig: { trackId: 'reinvent_base' } },
          { leaderboardId: 'lb-002', trackConfig: { trackId: 'reinvent_base' } },
        ] as unknown as ReturnType<typeof mockListEventTracksQuery>['data'],
        isLoading: false,
      });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.leaderboards.header'))).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18n.t('events:detail.tracks.combinedLeaderboard.headerFallback')),
      ).not.toBeInTheDocument();
    });

    it('does not show the combined leaderboard when the event has fewer than 2 tracks', async () => {
      mockGetEventQuery.mockReturnValue({
        data: { ...mockEvent, combinedScoringStrategy: 'BEST_LAP' } as unknown as typeof mockEvent,
        isLoading: false,
      });
      mockListEventTracksQuery.mockReturnValue({
        data: [{ leaderboardId: 'lb-001', trackConfig: { trackId: 'reinvent_base' } }] as unknown as ReturnType<
          typeof mockListEventTracksQuery
        >['data'],
        isLoading: false,
      });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.leaderboards.header'))).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18n.t('events:detail.tracks.combinedLeaderboard.headerFallback')),
      ).not.toBeInTheDocument();
    });

    it('shows the combined leaderboard after the tracks table when the event has a combinedScoringStrategy and 2+ tracks', async () => {
      mockGetEventQuery.mockReturnValue({
        data: { ...mockEvent, combinedScoringStrategy: 'BEST_LAP' } as unknown as typeof mockEvent,
        isLoading: false,
      });
      mockListEventTracksQuery.mockReturnValue({
        data: [
          { leaderboardId: 'lb-001', trackConfig: { trackId: 'reinvent_base' } },
          { leaderboardId: 'lb-002', trackConfig: { trackId: 'reinvent_base' } },
        ] as unknown as ReturnType<typeof mockListEventTracksQuery>['data'],
        isLoading: false,
      });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.leaderboards.header'))).toBeInTheDocument();
      });

      const leaderboardsHeader = screen.getByText(i18n.t('events:detail.leaderboards.header'));
      const combinedHeader = await screen.findByText(i18n.t('events:detail.tracks.combinedLeaderboard.headerFallback'));

      expect(combinedHeader).toBeInTheDocument();
      // Combined leaderboard must appear after the per-track Leaderboards table in DOM order.
      expect(leaderboardsHeader.compareDocumentPosition(combinedHeader)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('switches to the Runs tab content when clicked', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: i18n.t('events:detail.tabs.runs') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: i18n.t('events:detail.tabs.runs') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.runs.lookup.header'))).toBeInTheDocument();
      });
    });
  });

  describe('lifecycle transition', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('calls transitionEventStatus with OPEN action when transition button is clicked on a DRAFT event', async () => {
      render(<EventDetail />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }));

      await waitFor(() => {
        expect(mockTransitionEventStatus).toHaveBeenCalledWith(
          expect.objectContaining({ eventId: 'evt-001', action: 'OPEN' }),
        );
      });
    });

    it('logs an error when transition fails without crashing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
      mockTransitionEventStatus.mockReturnValue({
        unwrap: () => Promise.reject(new Error('Conflict')),
      });

      render(<EventDetail />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.lifecycle.transitionButton.OPEN') }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to transition event status', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('when permission check fails', () => {
    it('logs an error and clears the permission loading state so the page renders', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
      mockCheckUserGroupMembership.mockRejectedValue(new Error('Auth failure'));

      render(<EventDetail />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load permissions', expect.any(Error));
      });

      // isPermissionLoading resets in .finally() — spinner should clear and unauthorized view should render
      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:unauthorized.message'))).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('loading and not-found states', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders a spinner while the event is loading', async () => {
      mockGetEventQuery.mockReturnValue({ data: mockEvent, isLoading: true });
      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.header'))).toBeInTheDocument();
      });
    });

    it('renders not-found message when event data is absent', async () => {
      mockGetEventQuery.mockReturnValue({ data: null as unknown as typeof mockEvent, isLoading: false });

      render(<EventDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.notFound'))).toBeInTheDocument();
      });
    });
  });
});
