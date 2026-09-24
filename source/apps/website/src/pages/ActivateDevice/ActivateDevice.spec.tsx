// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarType, DeviceStatus, DeviceType, Fleet } from '@deepracer-indy/typescript-client';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { useListDevicesQuery } from '#services/deepRacer/devicesApi.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { render, screen, waitFor } from '#utils/testUtils';

import ActivateDevice from './ActivateDevice';

vi.mock('#utils/authUtils.js', () => ({
  checkUserGroupMembership: vi.fn(),
}));

const mockActivateDevice = vi.fn();

vi.mock('#services/deepRacer/devicesApi.js', () => ({
  useActivateDeviceMutation: vi.fn(() => [mockActivateDevice, { isLoading: false }]),
  useListDevicesQuery: vi.fn(() => ({ data: [], isLoading: false, refetch: vi.fn() })),
}));

vi.mock('#hooks/useDeviceMqtt.js', () => ({
  useDeviceMqtt: vi.fn(() => ({ connectionStatus: 'CONNECTED' })),
  ConnectionStatus: { CONNECTING: 'CONNECTING', CONNECTED: 'CONNECTED', DISCONNECTED: 'DISCONNECTED', ERROR: 'ERROR' },
}));

const mockFleets: Fleet[] = [
  { fleetId: 'fleet-1', name: 'Alpha Fleet', createdAt: new Date() },
  { fleetId: 'fleet-2', name: 'Beta Fleet', createdAt: new Date() },
];

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: vi.fn(() => ({ data: mockFleets, isLoading: false })),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

const mockCheckUserGroupMembership = vi.mocked(checkUserGroupMembership);

describe('<ActivateDevice />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivateDevice.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          activationId: 'act-123',
          activationCode: 'code-abc',
          region: 'us-east-1',
          expiresAt: new Date('2026-12-31'),
        }),
    });
    mockNavigate.mockReset();
  });

  describe('when user is an Admin', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    it('renders the wizard with the first step', async () => {
      render(<ActivateDevice />);

      await waitFor(() => {
        // "Device type" appears both as step title and field label
        const elements = screen.getAllByText(i18n.t('devices:wizard.steps.type.title'));
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('renders all step titles in the wizard navigation', async () => {
      render(<ActivateDevice />);

      await waitFor(() => {
        const elements = screen.getAllByText(i18n.t('devices:wizard.steps.type.title'));
        expect(elements.length).toBeGreaterThan(0);
      });

      expect(screen.getByText(i18n.t('devices:wizard.steps.fleet.title'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('devices:wizard.steps.configure.title'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('devices:wizard.steps.params.title'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('devices:wizard.steps.wait.title'))).toBeInTheDocument();
    });

    it('renders device type select on step 1', async () => {
      render(<ActivateDevice />);

      await waitFor(() => {
        // "Device type" appears as both step title and field label
        const elements = screen.getAllByText(i18n.t('devices:wizard.typeLabel'));
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders cancel button', async () => {
      render(<ActivateDevice />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: i18n.t('devices:wizard.cancel') })).toBeInTheDocument();
      });
    });
  });

  describe('completing the wizard', () => {
    beforeEach(() => {
      mockCheckUserGroupMembership.mockResolvedValue(true);
    });

    // Drive the wizard: pick a device type (step 1) → Next past the optional fleet step (step 2) →
    // name the device on the configure step (step 3). Leaves the wizard ready to activate.
    const advanceToConfigureAndName = async (
      user: ReturnType<typeof userEvent.setup>,
      deviceTypeLabel: string = i18n.t('devices:deviceType.CAR'),
    ) => {
      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('devices:wizard.steps.type.title')).length).toBeGreaterThan(0);
      });
      await user.click(screen.getByLabelText(i18n.t('devices:wizard.typeLabel')));
      await user.click(screen.getByRole('option', { name: deviceTypeLabel }));

      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));
      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));

      await user.type(screen.getByLabelText(i18n.t('devices:wizard.nameLabel')), 'car-01');
    };

    it('activates the device and renders the shell-quoted activation commands', async () => {
      const user = userEvent.setup();
      render(<ActivateDevice />);

      await advanceToConfigureAndName(user);
      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));

      await waitFor(() => {
        expect(mockActivateDevice).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'car-01', deviceType: DeviceType.CAR }),
        );
      });

      // Params step: buildOneLiner + shellQuote (name single-quoted) and buildSsmOneLiner.
      // Each command renders twice (visible code box + CopyToClipboard), so match all.
      await waitFor(() => {
        expect(screen.getAllByText(/car_activation\.sh/).length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText(/-h 'car-01'/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/amazon-ssm-agent -register/).length).toBeGreaterThan(0);
    });

    it('surfaces the error and stays on the configure step when activation fails', async () => {
      const user = userEvent.setup();
      mockActivateDevice.mockReturnValue({ unwrap: () => Promise.reject(new Error('activation failed')) });

      render(<ActivateDevice />);

      await advanceToConfigureAndName(user);
      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));

      await waitFor(() => {
        expect(mockActivateDevice).toHaveBeenCalled();
      });
      // Activation failed, so the wizard never advances to the params step / command output.
      expect(screen.queryByText(/car_activation\.sh/)).not.toBeInTheDocument();
      // The error is surfaced on the configure step, where the failure leaves the user.
      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:wizard.activateError'))).toBeInTheDocument();
      });
    });

    it('appends Wi-Fi, console-password, and community-console flags for a car', async () => {
      const user = userEvent.setup();
      render(<ActivateDevice />);

      await advanceToConfigureAndName(user);
      await user.type(screen.getByLabelText(i18n.t('devices:wizard.ssidLabel')), 'venue-net');
      await user.type(screen.getByLabelText(i18n.t('devices:wizard.wifiPasswordLabel')), 'wifi-pass');
      await user.type(screen.getByLabelText(i18n.t('devices:wizard.consolePasswordLabel')), 'console-pass');
      await user.click(screen.getByRole('checkbox', { name: i18n.t('devices:wizard.communityConsoleLabel') }));

      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));

      await waitFor(() => {
        expect(screen.getAllByText(/car_activation\.sh/).length).toBeGreaterThan(0);
      });
      // The car-only branch appends each optional flag, shell-quoted, plus the -u community flag.
      expect(screen.getAllByText(/-s 'venue-net' -w 'wifi-pass'/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/-p 'console-pass'/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ -u$/).length).toBeGreaterThan(0);
    });

    it('generates the timer command without any car-only flags', async () => {
      const user = userEvent.setup();
      render(<ActivateDevice />);

      await advanceToConfigureAndName(user, i18n.t('devices:deviceType.TIMER'));
      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));

      await waitFor(() => {
        expect(screen.getAllByText(/timer_activation\.sh/).length).toBeGreaterThan(0);
      });
      expect(screen.queryByText(/car_activation\.sh/)).not.toBeInTheDocument();
      // The isCar block is skipped, so no Wi-Fi/console/community flags are emitted.
      expect(screen.queryByText(/ -s /)).not.toBeInTheDocument();
      expect(screen.queryByText(/ -u$/)).not.toBeInTheDocument();
    });

    // Drive the wizard all the way to the final "wait for online" step (index 4): activate on
    // the configure step (→ params, step 3), then advance once more (→ wait, step 4).
    const advanceToWaitStep = async (user: ReturnType<typeof userEvent.setup>) => {
      await advanceToConfigureAndName(user);
      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));
      await waitFor(() => {
        expect(mockActivateDevice).toHaveBeenCalled();
      });
      await user.click(screen.getByRole('button', { name: i18n.t('devices:wizard.next') }));
    };

    it('shows the detected car type on the wait step once the online device reports it', async () => {
      vi.mocked(useListDevicesQuery).mockReturnValue({
        data: [
          {
            instanceId: 'mi-abc',
            name: 'car-01',
            deviceType: DeviceType.CAR,
            carType: CarType.DEEPRACER_RPI,
            status: DeviceStatus.ONLINE,
            activatedAt: new Date(),
          },
        ],
        isLoading: false,
        refetch: vi.fn(),
      } as never);

      const user = userEvent.setup();
      render(<ActivateDevice />);
      await advanceToWaitStep(user);

      await waitFor(() => {
        expect(
          screen.getByText(
            i18n.t('devices:wizard.detectedCarType', { carType: i18n.t('devices:carType.DEEPRACER_RPI') }),
          ),
        ).toBeInTheDocument();
      });
    });

    it('shows a detecting indicator on the wait step until the car type tag lands', async () => {
      // Online CAR device whose self-tag has not yet been read into the row (no carType).
      vi.mocked(useListDevicesQuery).mockReturnValue({
        data: [
          {
            instanceId: 'mi-abc',
            name: 'car-01',
            deviceType: DeviceType.CAR,
            status: DeviceStatus.ONLINE,
            activatedAt: new Date(),
          },
        ],
        isLoading: false,
        refetch: vi.fn(),
      } as never);

      const user = userEvent.setup();
      render(<ActivateDevice />);
      await advanceToWaitStep(user);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('devices:wizard.detectingCarType'))).toBeInTheDocument();
      });
    });
  });
});
