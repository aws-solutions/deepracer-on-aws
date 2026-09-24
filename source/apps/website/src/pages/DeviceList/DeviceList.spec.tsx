// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Device, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageId } from '#constants/pages';
import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import DeviceList from './DeviceList';

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

const mockDeleteDevice = vi.fn();
const mockBatchUpdateDevice = vi.fn();

vi.mock('#services/deepRacer/devicesApi.js', () => ({
  useListDevicesQuery: vi.fn(() => ({ data: mockDevices, isLoading: false, isFetching: false, refetch: vi.fn() })),
  useDeleteDeviceMutation: vi.fn(() => [mockDeleteDevice, { isLoading: false }]),
  useBatchUpdateDeviceMutation: vi.fn(() => [mockBatchUpdateDevice, { isLoading: false }]),
}));

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: vi.fn(() => ({
    data: [{ fleetId: 'fleet-a', name: 'Fleet A' }],
    isLoading: false,
  })),
}));

const mockNavigatePush = vi.fn();

vi.mock('#hooks/useDeviceMqtt.js', () => ({
  useDeviceMqtt: vi.fn(() => ({ connectionStatus: 'CONNECTED' })),
  ConnectionStatus: { CONNECTING: 'CONNECTING', CONNECTED: 'CONNECTED', DISCONNECTED: 'DISCONNECTED', ERROR: 'ERROR' },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigatePush,
  };
});

const mockDevices: Device[] = [
  {
    instanceId: 'mi-001',
    name: 'Car Alpha',
    deviceType: DeviceType.CAR,
    status: DeviceStatus.ONLINE,
    fleetId: 'fleet-a',
    activatedAt: new Date('2025-06-01'),
    lastSeenAt: new Date('2025-06-10T10:00:00Z'),
  },
  {
    instanceId: 'mi-002',
    name: 'Timer Beta',
    deviceType: DeviceType.TIMER,
    status: DeviceStatus.OFFLINE,
    activatedAt: new Date('2025-05-01'),
  },
  {
    instanceId: 'mi-003',
    name: 'Car Gamma',
    deviceType: DeviceType.CAR,
    status: DeviceStatus.OFFLINE,
    fleetId: 'fleet-b',
    activatedAt: new Date('2025-07-01'),
    lastSeenAt: new Date('2025-07-02T08:30:00Z'),
  },
];

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<DeviceList />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteDevice.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockBatchUpdateDevice.mockReturnValue({
      unwrap: () => Promise.resolve({ assignedInstanceIds: ['mi-001'], errors: [] }),
    });
  });

  describe('when user is authorized', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the devices table with column headers', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:list.header'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18n.t('devices:list.columnHeaders.name'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('devices:list.columnHeaders.deviceType'))).toBeInTheDocument();
      expect(screen.getAllByText(i18n.t('devices:list.columnHeaders.status')).length).toBeGreaterThan(0);
    });

    it('renders device names from the API response', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText('Car Alpha')).toBeInTheDocument();
      });

      expect(screen.getByText('Timer Beta')).toBeInTheDocument();
      expect(screen.getByText('Car Gamma')).toBeInTheDocument();
    });

    it('renders device status indicators', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:status.ONLINE'))).toBeInTheDocument();
      });

      expect(screen.getAllByText(i18n.t('devices:status.OFFLINE')).length).toBeGreaterThan(0);
    });

    it('renders device type labels', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('devices:deviceType.CAR')).length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText(i18n.t('devices:deviceType.TIMER')).length).toBeGreaterThan(0);
    });

    it('renders the fleet name (falling back to id) or unassigned label', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        // fleet-a resolves to its name via the fleets list.
        expect(screen.getByText('Fleet A')).toBeInTheDocument();
      });

      // fleet-b has no matching fleet in the list → falls back to the raw id.
      expect(screen.getByText('fleet-b')).toBeInTheDocument();
      expect(screen.getByText(i18n.t('devices:unassignedFleet'))).toBeInTheDocument();
    });

    it('renders the View Details button', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:list.viewDetailsButton') })).toBeInTheDocument();
      });
    });

    it('renders the Activate device button', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:list.activateButton') })).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders loading text while devices are fetching', async () => {
      const { useListDevicesQuery } = await import('#services/deepRacer/devicesApi.js');
      vi.mocked(useListDevicesQuery).mockReturnValue({
        data: [],
        isLoading: true,
        isFetching: true,
        refetch: vi.fn(),
      } as ReturnType<typeof useListDevicesQuery>);

      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:list.loadingText'))).toBeInTheDocument();
      });
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders all devices when filters are ALL', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText('Car Alpha')).toBeInTheDocument();
      });

      expect(screen.getByText('Timer Beta')).toBeInTheDocument();
      expect(screen.getByText('Car Gamma')).toBeInTheDocument();
    });

    it('shows the type filter dropdown with all type options', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:list.filters.allTypes'))).toBeInTheDocument();
      });
    });

    it('shows the status filter dropdown with all status options', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:list.filters.allStatuses'))).toBeInTheDocument();
      });
    });
  });

  describe('header action buttons', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('calls refetch when the refresh button is clicked', async () => {
      const { useListDevicesQuery } = await import('#services/deepRacer/devicesApi.js');
      const mockRefetch = vi.fn();
      vi.mocked(useListDevicesQuery).mockReturnValue({
        data: mockDevices,
        isLoading: false,
        isFetching: false,
        refetch: mockRefetch,
      } as ReturnType<typeof useListDevicesQuery>);

      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:list.header'))).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: i18n.t('devices:list.refreshButtonLabel') });
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('navigates to the device detail page when a row is selected and View Details is clicked', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText('Car Alpha')).toBeInTheDocument();
      });

      // Multi-select table: checkbox[0] is the select-all header, [1] is the first row.
      fireEvent.click(screen.getAllByRole('checkbox')[1]);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:list.viewDetailsButton') }));

      expect(mockNavigatePush).toHaveBeenCalledWith(getPath(PageId.DEVICE_DETAIL, { instanceId: 'mi-001' }));
    });

    it('bulk-assigns selected devices to a fleet via Move to fleet', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText('Car Alpha')).toBeInTheDocument();
      });

      // Select the first two rows, then open the bulk Move-to-fleet modal.
      fireEvent.click(screen.getAllByRole('checkbox')[1]);
      fireEvent.click(screen.getAllByRole('checkbox')[2]);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:list.moveToFleet.button') }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:list.moveToFleet.confirm') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:list.moveToFleet.confirm') }));

      await waitFor(() => {
        // Default selection is Unassigned → fleetId undefined; both selected instance ids sent.
        expect(mockBatchUpdateDevice).toHaveBeenCalledWith({
          instanceIds: ['mi-001', 'mi-002'],
          fleetId: undefined,
        });
      });
    });

    it('closes the move modal and recovers when the bulk assign fails', async () => {
      mockBatchUpdateDevice.mockReturnValue({ unwrap: () => Promise.reject(new Error('bulk failed')) });

      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText('Car Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('checkbox')[1]);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:list.moveToFleet.button') }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:list.moveToFleet.confirm') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:list.moveToFleet.confirm') }));

      await waitFor(() => {
        expect(mockBatchUpdateDevice).toHaveBeenCalled();
      });
      // The finally-block closes the modal even on failure.
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: i18n.t('devices:list.moveToFleet.confirm') }),
        ).not.toBeInTheDocument();
      });
    });

    it('navigates to the activate device page when Activate device is clicked', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:list.activateButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:list.activateButton') }));

      expect(mockNavigatePush).toHaveBeenCalledWith(getPath(PageId.ACTIVATE_DEVICE));
    });

    it('View Details button is disabled when no device is selected', async () => {
      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:list.viewDetailsButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('devices:list.viewDetailsButton') })).toBeDisabled();
    });
  });

  describe('query skipping', () => {
    it('shows the table once the user is authorized', async () => {
      mockCheckUserGroupMembership.mockResolvedValue(true);

      render(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:list.header'))).toBeInTheDocument();
      });
    });
  });
});
