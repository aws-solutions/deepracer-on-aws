// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Event, EventStatus, EventType, RaceFormat } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageId } from '#constants/pages';
import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import EventList from './EventList';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('#store/notifications/notificationsSlice.js', () => ({
  displaySuccessNotification: vi.fn((args) => args),
  displayErrorNotification: vi.fn((args) => args),
}));

const mockDeleteEvent = vi.fn();

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useListEventsQuery: vi.fn(() => ({ data: mockEvents, isLoading: false, isFetching: false, refetch: vi.fn() })),
  useDeleteEventMutation: vi.fn(() => [mockDeleteEvent, { isLoading: false }]),
}));

const mockNavigatePush = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigatePush,
  };
});

const mockEvents: Event[] = [
  {
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
  },
  {
    eventId: 'evt-002',
    name: 'Summit Race Berlin',
    eventType: EventType.AWS_SUMMIT,
    eventDate: '2025-06-15',
    countryCode: 'DE',
    raceFormat: RaceFormat.AVERAGE_LAPS,
    maxLaps: 8,
    maxTimeInMinutes: 5,
    maxResets: 5,
    eventStatus: EventStatus.IN_PROGRESS,
    sponsor: 'AWS',
    createdBy: 'TestAdmin',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-01'),
  },
];

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<EventList />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteEvent.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  describe('when user is an Admin', () => {
    beforeEach(() => {
      // Both calls (authorized, admin) → true
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the events table with column headers', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('events:list.columnHeaders.name'))).toBeInTheDocument();
      expect(screen.getAllByText(i18n.t('events:list.columnHeaders.eventStatus')).length).toBeGreaterThan(0);
    });

    it('renders event names from the API response', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      expect(screen.getByText('Summit Race Berlin')).toBeInTheDocument();
    });

    it('renders event status indicators', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:status.DRAFT'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('events:status.IN_PROGRESS'))).toBeInTheDocument();
    });

    it('renders admin action buttons', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.createEventButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('events:list.editEventButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') })).toBeInTheDocument();
    });

    it('renders the View Details button', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.viewDetailsButton') })).toBeInTheDocument();
      });
    });
  });

  describe('when user is a Facilitator (not Admin)', () => {
    beforeEach(() => {
      // authorized → true, admin → false
      mockCheckUserGroupMembership.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    });

    it('shows the table and View Details button but not admin-only action buttons', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.viewDetailsButton') })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('events:list.createEventButton') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('events:list.editEventButton') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('events:list.deleteEventButton') })).not.toBeInTheDocument();
    });
  });

  describe('when user is a Racer', () => {
    beforeEach(() => {
      // authorized → true, admin → false
      mockCheckUserGroupMembership.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    });

    it('shows the table and View Details button but not any write action buttons', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.viewDetailsButton') })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: i18n.t('events:list.createEventButton') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('events:list.editEventButton') })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('events:list.deleteEventButton') })).not.toBeInTheDocument();
    });
  });

  describe('when user is not authorized', () => {
    beforeEach(() => {
      // All three calls → false
      mockCheckUserGroupMembership.mockResolvedValue(false);
    });

    it('renders the unauthorized message instead of the table', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:unauthorized.message'))).toBeInTheDocument();
      });

      expect(screen.queryByText(i18n.t('events:list.header'))).not.toBeInTheDocument();
    });
  });

  describe('permission-loading race condition', () => {
    it('does not flash the unauthorized page for an authorized user while permissions are still resolving', async () => {
      // The list query resolves immediately (isLoading: false per the module mock above),
      // but permission resolution is deliberately delayed here to reproduce the race:
      // if isLoading were the only gate, the unauthorized page would render in the gap
      // before checkUserGroupMembership resolves.
      let resolvePermissions!: (value: boolean) => void;
      mockCheckUserGroupMembership.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePermissions = resolve;
          }),
      );

      render(<EventList />);

      expect(screen.queryByText(i18n.t('events:unauthorized.message'))).not.toBeInTheDocument();

      resolvePermissions(true);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });

      expect(screen.queryByText(i18n.t('events:unauthorized.message'))).not.toBeInTheDocument();
    });
  });

  describe('delete confirmation flow', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('does not show the delete confirmation modal on initial render', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });

      // Use the modal body text (which is unique) rather than the title (which matches the button label)
      expect(
        screen.queryByText(i18n.t('events:list.deleteConfirmMessage', { name: '' }), { exact: false }),
      ).not.toBeInTheDocument();
    });

    it('delete button is disabled when no event is selected', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') })).toBeDisabled();
    });
  });

  describe('when permission check fails', () => {
    it('logs an error, resets permission loading, and renders the unauthorized view', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
      mockCheckUserGroupMembership.mockRejectedValue(new Error('Auth failure'));

      render(<EventList />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load permissions', expect.any(Error));
      });

      // isPermissionLoading resets in .finally() — the unauthorized view should render
      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:unauthorized.message'))).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders loading text while events are fetching', async () => {
      const { useListEventsQuery } = await import('#services/deepRacer/eventsApi.js');
      vi.mocked(useListEventsQuery).mockReturnValue({
        data: [],
        isLoading: true,
        isFetching: true,
        refetch: vi.fn(),
      } as ReturnType<typeof useListEventsQuery>);

      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.loadingText'))).toBeInTheDocument();
      });
    });
  });

  describe('status filtering', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders all events when status filter is ALL', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      expect(screen.getByText('Summit Race Berlin')).toBeInTheDocument();
    });

    it('shows the status filter dropdown with all status options', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.filters.allStatuses'))).toBeInTheDocument();
      });
    });
  });

  describe('header action buttons', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('calls refetch when the refresh button is clicked', async () => {
      const { useListEventsQuery } = await import('#services/deepRacer/eventsApi.js');
      const mockRefetch = vi.fn();
      vi.mocked(useListEventsQuery).mockReturnValue({
        data: mockEvents,
        isLoading: false,
        isFetching: false,
        refetch: mockRefetch,
      } as ReturnType<typeof useListEventsQuery>);

      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: i18n.t('events:list.refreshButtonLabel') });
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('navigates to the event detail page when a row is selected and View Details is clicked', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.viewDetailsButton') }));

      expect(mockNavigatePush).toHaveBeenCalledWith(getPath(PageId.EVENT_DETAIL, { eventId: 'evt-001' }));
    });

    it('navigates to the event detail page when the event name link is clicked (no selection needed)', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('link', { name: 're:Invent 2025 Race' }));

      expect(mockNavigatePush).toHaveBeenCalledWith(getPath(PageId.EVENT_DETAIL, { eventId: 'evt-001' }));
    });

    it('navigates to the edit event page when a row is selected and Edit is clicked (admin only)', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.editEventButton') }));

      expect(mockNavigatePush).toHaveBeenCalledWith(getPath(PageId.EDIT_EVENT, { eventId: 'evt-001' }));
    });

    it('navigates to the create event page when Create Event is clicked (admin only)', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('events:list.createEventButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.createEventButton') }));

      expect(mockNavigatePush).toHaveBeenCalledWith(getPath(PageId.CREATE_EVENT));
    });

    it('opens the delete confirmation modal when a row is selected and Delete is clicked', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') }));

      expect(
        screen.getByText(i18n.t('events:list.deleteConfirmMessage', { name: 're:Invent 2025 Race' }), {
          exact: false,
        }),
      ).toBeInTheDocument();
    });

    it('calls deleteEvent and closes the modal when delete is confirmed', async () => {
      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') }));

      const deleteButtons = screen.getAllByRole('button', { name: i18n.t('events:list.deleteEventButton') });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      await waitFor(() => {
        expect(mockDeleteEvent).toHaveBeenCalledWith({ eventId: 'evt-001' });
      });

      await waitFor(() => {
        expect(
          screen.queryByText(i18n.t('events:list.deleteConfirmMessage', { name: 're:Invent 2025 Race' }), {
            exact: false,
          }),
        ).not.toBeInTheDocument();
      });
    });

    it('logs an error and keeps the modal open when delete fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
      mockDeleteEvent.mockReturnValue({ unwrap: () => Promise.reject(new Error('Conflict')) });

      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText('re:Invent 2025 Race')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') }));

      const deleteButtons = screen.getAllByRole('button', { name: i18n.t('events:list.deleteEventButton') });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete event', expect.any(Error));
      });

      expect(
        screen.getByText(i18n.t('events:list.deleteConfirmMessage', { name: 're:Invent 2025 Race' }), {
          exact: false,
        }),
      ).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('query skipping', () => {
    it('shows the table once the user is authorized', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);

      render(<EventList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:list.header'))).toBeInTheDocument();
      });
    });
  });
});
