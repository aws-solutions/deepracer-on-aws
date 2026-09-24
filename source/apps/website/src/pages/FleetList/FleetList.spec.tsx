// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Fleet } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import FleetList from './FleetList';

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

const mockDeleteFleet = vi.fn();
const mockCreateFleet = vi.fn();
const mockUpdateFleet = vi.fn();

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: vi.fn(() => ({ data: mockFleets, isLoading: false, isFetching: false, refetch: vi.fn() })),
  useDeleteFleetMutation: vi.fn(() => [mockDeleteFleet, { isLoading: false }]),
  useCreateFleetMutation: vi.fn(() => [mockCreateFleet, { isLoading: false }]),
  useUpdateFleetMutation: vi.fn(() => [mockUpdateFleet, { isLoading: false }]),
}));

const mockFleets: Fleet[] = [
  {
    fleetId: 'fleet-001',
    name: 'London Fleet',
    createdAt: new Date('2025-06-01'),
    deviceCount: 5,
  },
  {
    fleetId: 'fleet-002',
    name: 'Sydney Fleet',
    createdAt: new Date('2025-07-15'),
    deviceCount: 3,
  },
];

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<FleetList />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteFleet.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockCreateFleet.mockReturnValue({ unwrap: () => Promise.resolve('fleet-003') });
    mockUpdateFleet.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  describe('when user is an Admin', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the fleets table with column headers', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('fleets:list.header'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('fleets:list.columnHeaders.name'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('fleets:list.columnHeaders.deviceCount'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('fleets:list.columnHeaders.createdAt'))).toBeInTheDocument();
    });

    it('renders fleet names from the API response', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText('London Fleet')).toBeInTheDocument();
      });

      expect(screen.getByText('Sydney Fleet')).toBeInTheDocument();
    });

    it('renders admin action buttons', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('fleets:list.createButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('fleets:list.editButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('fleets:list.deleteButton') })).toBeInTheDocument();
    });

    it('calls refetch when the refresh button is clicked', async () => {
      const { useListFleetsQuery } = await import('#services/deepRacer/fleetsApi.js');
      const mockRefetch = vi.fn();
      vi.mocked(useListFleetsQuery).mockReturnValue({
        data: mockFleets,
        isLoading: false,
        isFetching: false,
        refetch: mockRefetch,
      } as ReturnType<typeof useListFleetsQuery>);

      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('fleets:list.header'))).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: i18n.t('fleets:list.refreshButtonLabel') });
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('opens create fleet modal when Create fleet is clicked', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('fleets:list.createButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('fleets:list.createButton') }));

      expect(screen.getByRole('heading', { name: i18n.t('fleets:form.createTitle') })).toBeInTheDocument();
    });

    it('opens edit fleet modal when a fleet is selected and Edit is clicked', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText('London Fleet')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('fleets:list.editButton') }));

      expect(screen.getByRole('heading', { name: i18n.t('fleets:form.editTitle') })).toBeInTheDocument();
    });

    it('opens delete confirmation modal when a fleet is selected and Delete is clicked', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText('London Fleet')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('fleets:list.deleteButton') }));

      expect(
        screen.getByText(i18n.t('fleets:list.deleteConfirmMessage', { name: 'London Fleet' }), { exact: false }),
      ).toBeInTheDocument();
    });

    it('calls deleteFleet and closes the modal when delete is confirmed', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText('London Fleet')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('fleets:list.deleteButton') }));

      const deleteButtons = screen.getAllByRole('button', { name: i18n.t('fleets:list.deleteButton') });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      await waitFor(() => {
        expect(mockDeleteFleet).toHaveBeenCalledWith({ fleetId: 'fleet-001' });
      });

      await waitFor(() => {
        expect(
          screen.queryByText(i18n.t('fleets:list.deleteConfirmMessage', { name: 'London Fleet' }), { exact: false }),
        ).not.toBeInTheDocument();
      });
    });

    it('shows error notification on 409 conflict when deleting', async () => {
      const error = new Error('Conflict');
      Object.assign(error, { status: 409 });
      mockDeleteFleet.mockReturnValue({ unwrap: () => Promise.reject(error) });

      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText('London Fleet')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('fleets:list.deleteButton') }));

      const deleteButtons = screen.getAllByRole('button', { name: i18n.t('fleets:list.deleteButton') });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      await waitFor(() => {
        expect(mockDeleteFleet).toHaveBeenCalledWith({ fleetId: 'fleet-001' });
      });

      // Modal stays open because error occurred
      expect(
        screen.getByText(i18n.t('fleets:list.deleteConfirmMessage', { name: 'London Fleet' }), { exact: false }),
      ).toBeInTheDocument();
    });

    it('delete button is disabled when no fleet is selected', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('fleets:list.deleteButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('fleets:list.deleteButton') })).toBeDisabled();
    });

    it('edit button is disabled when no fleet is selected', async () => {
      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('fleets:list.editButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('fleets:list.editButton') })).toBeDisabled();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders loading text while fleets are fetching', async () => {
      const { useListFleetsQuery } = await import('#services/deepRacer/fleetsApi.js');
      vi.mocked(useListFleetsQuery).mockReturnValue({
        data: [],
        isLoading: true,
        isFetching: true,
        refetch: vi.fn(),
      } as ReturnType<typeof useListFleetsQuery>);

      render(<FleetList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('fleets:list.loadingText'))).toBeInTheDocument();
      });
    });
  });
});
