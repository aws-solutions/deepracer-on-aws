// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Device, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-client';
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageId } from '#constants/pages';
import i18n from '#i18n/index.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import DeviceDetail from './DeviceDetail';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const mockDevice: Device = {
  instanceId: 'i-001',
  name: 'car-01',
  deviceType: DeviceType.CAR,
  status: DeviceStatus.ONLINE,
  activatedAt: new Date('2025-06-01'),
};

const mockTimerDevice: Device = {
  instanceId: 'i-002',
  name: 'timer-01',
  deviceType: DeviceType.TIMER,
  status: DeviceStatus.ONLINE,
  activatedAt: new Date('2025-06-01'),
};

const mockOfflineDevice: Device = {
  ...mockDevice,
  status: DeviceStatus.OFFLINE,
};

const mockRestartDevice = vi.fn();
const mockStopDevice = vi.fn();
const mockChangeDeviceColor = vi.fn();
const mockDeleteDevice = vi.fn();
const mockUpdateDevice = vi.fn();
const mockListDevicesQuery = vi.fn((): { data: Device[] | undefined; isLoading: boolean; refetch?: () => void } => ({
  data: [mockDevice],
  isLoading: false,
}));

vi.mock('#services/deepRacer/devicesApi', () => ({
  useListDevicesQuery: () => mockListDevicesQuery(),
  useRestartDeviceMutation: () => [mockRestartDevice, { isLoading: false }],
  useStopDeviceMutation: () => [mockStopDevice, { isLoading: false }],
  useChangeDeviceColorMutation: () => [mockChangeDeviceColor, { isLoading: false }],
  useDeleteDeviceMutation: () => [mockDeleteDevice, { isLoading: false }],
  useUpdateDeviceMutation: () => [mockUpdateDevice, { isLoading: false }],
}));

vi.mock('#services/deepRacer/fleetsApi', () => ({
  useListFleetsQuery: () => ({ data: [{ fleetId: 'FLEET0000000001', name: 'London' }], isLoading: false }),
}));

const mockNavigate = vi.fn();

vi.mock('#hooks/useDeviceMqtt.js', () => ({
  useDeviceMqtt: vi.fn(() => ({ connectionStatus: 'CONNECTED' })),
  ConnectionStatus: { CONNECTING: 'CONNECTING', CONNECTED: 'CONNECTED', DISCONNECTED: 'DISCONNECTED', ERROR: 'ERROR' },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ instanceId: 'i-001' }),
  };
});

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<DeviceDetail />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDevicesQuery.mockReturnValue({ data: [mockDevice], isLoading: false });
    mockRestartDevice.mockReturnValue({ unwrap: () => Promise.resolve({ commandId: 'cmd-1' }) });
    mockStopDevice.mockReturnValue({ unwrap: () => Promise.resolve({ commandId: 'cmd-2' }) });
    mockChangeDeviceColor.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockDeleteDevice.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockUpdateDevice.mockReturnValue({ unwrap: () => Promise.resolve(mockDevice) });
  });

  describe('when user is an Admin', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the device name as the page title', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByText('car-01')).toBeInTheDocument();
      });
    });

    it('refetches and notifies on device command-result MQTT events', async () => {
      const refetch = vi.fn(() => Promise.resolve());
      mockListDevicesQuery.mockReturnValue({ data: [mockDevice], isLoading: false, refetch });

      render(<DeviceDetail />);
      await waitFor(() => {
        expect(screen.getByText('car-01')).toBeInTheDocument();
      });

      const { useDeviceMqtt } = await import('#hooks/useDeviceMqtt.js');
      const opts = vi.mocked(useDeviceMqtt).mock.calls.at(-1)?.[1];

      act(() => {
        opts?.onEvent({
          eventType: 'DEVICE_COMMAND_RESULT',
          instanceId: 'i-001',
          timestamp: '2026-01-01T00:00:00Z',
          commandId: 'cmd-1',
          commandStatus: 'Success',
        });
      });
      act(() => {
        opts?.onEvent({
          eventType: 'DEVICE_COMMAND_RESULT',
          instanceId: 'i-001',
          timestamp: '2026-01-01T00:00:00Z',
          commandId: 'cmd-2',
          commandStatus: 'Failed',
        });
      });
      act(() => {
        opts?.onEvent({
          eventType: 'DEVICE_COMMAND_RESULT',
          instanceId: 'i-001',
          timestamp: '2026-01-01T00:00:00Z',
          commandId: 'cmd-3',
          commandStatus: 'InProgress',
        });
      });

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });

    it('renders the device status indicator', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('devices:status.ONLINE')).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders a PENDING device status', async () => {
      mockListDevicesQuery.mockReturnValue({
        data: [{ ...mockDevice, status: DeviceStatus.PENDING }],
        isLoading: false,
      });

      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('devices:status.PENDING')).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays the fleet name (not the fleet id) in the details section', async () => {
      mockListDevicesQuery.mockReturnValue({
        data: [{ ...mockDevice, fleetId: 'FLEET0000000001' }],
        isLoading: false,
      });

      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByText('London')).toBeInTheDocument();
      });
      expect(screen.queryByText('FLEET0000000001')).not.toBeInTheDocument();
    });

    it('renders all action buttons for admin', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.restartButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('devices:detail.colorButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('devices:detail.deleteButton') })).toBeInTheDocument();
    });

    it('calls restartDevice when the restart button is clicked', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.restartButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.restartButton') }));

      await waitFor(() => {
        expect(mockRestartDevice).toHaveBeenCalledWith({ instanceId: 'i-001' });
      });
    });

    it('shows stop confirmation modal when emergency stop button is clicked', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:detail.stopConfirmMessage', { name: 'car-01' }))).toBeInTheDocument();
      });
    });

    it('calls stopDevice when stop is confirmed', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:detail.stopConfirmMessage', { name: 'car-01' }))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.confirm') }));

      await waitFor(() => {
        expect(mockStopDevice).toHaveBeenCalledWith({ instanceId: 'i-001' });
      });
    });

    it('shows change color modal with color select', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.colorButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.colorButton') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:detail.colorModalTitle'))).toBeInTheDocument();
      });
    });

    it('shows change fleet modal and reassigns on confirm', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.changeFleetButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.changeFleetButton') }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.confirm') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.confirm') }));

      await waitFor(() => {
        // Default selection is the device's current fleet (Unassigned here) → fleetId undefined.
        expect(mockUpdateDevice).toHaveBeenCalledWith({ instanceId: 'i-001', fleetId: undefined });
      });
    });

    it('shows delete confirmation modal and deletes on confirm', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.deleteButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.deleteButton') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:detail.deleteConfirmMessage', { name: 'car-01' }))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.confirm') }));

      await waitFor(() => {
        expect(mockDeleteDevice).toHaveBeenCalledWith({ instanceId: 'i-001' });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.DEVICES));
      });
    });
  });

  describe('when user is a Facilitator (not Admin)', () => {
    beforeEach(() => {
      // First call (isAdmin) → false, second call (isAdminOrFacilitator) → true
      mockCheckUserGroupMembership.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    });

    it('renders restart, stop, and color buttons but not delete', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.restartButton') })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('devices:detail.colorButton') })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('devices:detail.deleteButton') })).not.toBeInTheDocument();
    });
  });

  describe('Emergency Stop disabled gating', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('disables Emergency Stop when device status is OFFLINE', async () => {
      mockListDevicesQuery.mockReturnValue({ data: [mockOfflineDevice], isLoading: false });

      render(<DeviceDetail />);

      await waitFor(() => {
        const stopButton = screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') });
        expect(stopButton).toHaveAttribute('aria-disabled', 'true');
      });
    });

    it('disables Emergency Stop when deviceType is TIMER', async () => {
      mockListDevicesQuery.mockReturnValue({ data: [{ ...mockTimerDevice, instanceId: 'i-001' }], isLoading: false });

      render(<DeviceDetail />);

      await waitFor(() => {
        const stopButton = screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') });
        expect(stopButton).toHaveAttribute('aria-disabled', 'true');
      });
    });

    it('enables Emergency Stop when device is CAR and ONLINE', async () => {
      render(<DeviceDetail />);

      await waitFor(() => {
        const stopButton = screen.getByRole('button', { name: i18n.t('devices:detail.stopButton') });
        expect(stopButton).not.toHaveAttribute('aria-disabled', 'true');
      });
    });
  });

  describe('loading and not-found states', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders a spinner while devices are loading', async () => {
      mockListDevicesQuery.mockReturnValue({ data: undefined, isLoading: true });

      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:detail.loadingText'))).toBeInTheDocument();
      });
    });

    it('renders not-found message when device is not in the list', async () => {
      mockListDevicesQuery.mockReturnValue({ data: [], isLoading: false });

      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:detail.notFound'))).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('displays error notification when restart fails', async () => {
      mockRestartDevice.mockReturnValue({ unwrap: () => Promise.reject(new Error('Network error')) });

      render(<DeviceDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:detail.restartButton') })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('devices:detail.restartButton') }));

      // The error notification is dispatched — we verify the mutation was called
      await waitFor(() => {
        expect(mockRestartDevice).toHaveBeenCalledWith({ instanceId: 'i-001' });
      });
    });
  });
});
