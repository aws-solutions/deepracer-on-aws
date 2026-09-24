// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeviceType, Lap, Run, RunStatus } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor, within } from '#utils/testUtils';

import { RecordedLaps } from '../RecordedLaps';

const {
  mockUseDeferredValue,
  mockUseListDevicesQuery,
  mockUseTimekeepingSession,
  mockUseSetLapValidityMutation,
  mockSetLapValidity,
} = vi.hoisted(() => ({
  mockUseDeferredValue: vi.fn(),
  mockUseListDevicesQuery: vi.fn(),
  mockUseTimekeepingSession: vi.fn(),
  mockUseSetLapValidityMutation: vi.fn(),
  mockSetLapValidity: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useDeferredValue: (value: unknown) => mockUseDeferredValue(value),
  };
});

vi.mock('#hooks/useTimekeepingSession.js', () => ({
  useTimekeepingLaps: () => mockUseTimekeepingSession(),
  useTimekeepingRun: () => mockUseTimekeepingSession(),
}));

vi.mock('#services/deepRacer/devicesApi.js', () => ({
  useListDevicesQuery: (input?: unknown, options?: unknown) => mockUseListDevicesQuery(input, options),
}));

vi.mock('#services/deepRacer/lapsApi.js', () => ({
  useSetLapValidityMutation: () => mockUseSetLapValidityMutation(),
}));

const run: Run = {
  runId: 'run-001',
  eventId: 'event-001',
  leaderboardId: 'leaderboard-001',
  profileId: 'profile-001',
  runStatus: RunStatus.IN_PROGRESS,
  racedByProxy: false,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

const laps: Lap[] = [
  {
    runId: run.runId,
    leaderboardId: run.leaderboardId,
    lapNumber: 1,
    lapTimeMs: 12000,
    isValid: true,
    resets: 0,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  },
  {
    runId: run.runId,
    leaderboardId: run.leaderboardId,
    lapNumber: 2,
    lapTimeMs: 10000,
    isValid: true,
    resets: 1,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  },
  {
    runId: run.runId,
    leaderboardId: run.leaderboardId,
    lapNumber: 3,
    lapTimeMs: 9000,
    isValid: false,
    resets: 0,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  },
];

describe('<RecordedLaps />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeferredValue.mockImplementation((value: unknown) => value);
    mockUseListDevicesQuery.mockReturnValue({ data: [], isLoading: false });
    mockUseSetLapValidityMutation.mockReturnValue([mockSetLapValidity, { isLoading: false }]);
    mockSetLapValidity.mockReturnValue({ unwrap: () => Promise.resolve({ lap: laps[0] }) });
  });

  it('renders the empty state when no active run is available', () => {
    mockUseTimekeepingSession.mockReturnValue({ activeRun: undefined, laps: [], isHydrating: false });
    render(<RecordedLaps />);

    expect(screen.getByText(i18n.t('timekeeping:lapTable.fastestEmptyTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('timekeeping:lapTable.emptyTitle'))).toBeInTheDocument();
  });

  it('renders the fastest valid lap and all persisted laps from the active session', () => {
    mockUseTimekeepingSession.mockReturnValue({ activeRun: run, laps, isHydrating: false });
    render(<RecordedLaps />);

    const fastestLap = within(screen.getByTestId('fastest-lap-table'));
    const recordedLaps = within(screen.getByTestId('recorded-laps-table'));

    expect(fastestLap.getByText('2')).toBeInTheDocument();
    expect(fastestLap.getAllByRole('row')).toHaveLength(2);
    expect(recordedLaps.getAllByRole('row')).toHaveLength(4);
    expect(recordedLaps.getByTestId('lap-time-invalid-3')).toBeInTheDocument();
  });

  it('keeps recorded laps visible during a deferred refetch transition', () => {
    mockUseDeferredValue.mockImplementation((value: unknown) => {
      const snapshot = value as { laps: Lap[]; isHydrating: boolean };
      return snapshot.isHydrating ? { laps, isHydrating: false } : snapshot;
    });
    mockUseTimekeepingSession.mockReturnValue({ activeRun: run, laps, isHydrating: false });
    const { rerender } = render(<RecordedLaps />);

    mockUseTimekeepingSession.mockReturnValue({ activeRun: run, laps: [], isHydrating: true });
    rerender(<RecordedLaps />);

    expect(within(screen.getByTestId('recorded-laps-table')).getAllByRole('row')).toHaveLength(4);
  });

  it('renders a car common name for a lap device ID', () => {
    const deviceId = 'i-0123456789abcdef0';
    mockUseTimekeepingSession.mockReturnValue({
      activeRun: run,
      laps: [{ ...laps[0], deviceId }],
      isHydrating: false,
    });
    mockUseListDevicesQuery.mockReturnValue({
      data: [{ instanceId: deviceId, name: 'Lightning', deviceType: DeviceType.CAR }],
      isLoading: false,
    });

    render(<RecordedLaps />);

    expect(mockUseListDevicesQuery).toHaveBeenCalledWith({ deviceType: DeviceType.CAR }, { skip: false });
    expect(screen.getAllByText('Lightning')).toHaveLength(2);
    expect(screen.queryByText(deviceId)).not.toBeInTheDocument();
  });

  it('marks a valid recorded lap invalid through SetLapValidity', async () => {
    mockUseTimekeepingSession.mockReturnValue({ activeRun: run, laps, isHydrating: false });
    render(<RecordedLaps />);

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('timekeeping:lapTable.markInvalid', { lapNumber: 1 }),
      }),
    );

    await waitFor(() => {
      expect(mockSetLapValidity).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-001',
        lapNumber: 1,
        isValid: false,
      });
    });
  });

  it('marks an invalid recorded lap valid through SetLapValidity', async () => {
    mockUseTimekeepingSession.mockReturnValue({ activeRun: run, laps, isHydrating: false });
    render(<RecordedLaps />);

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('timekeeping:lapTable.markValid', { lapNumber: 3 }),
      }),
    );

    await waitFor(() => {
      expect(mockSetLapValidity).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-001',
        lapNumber: 3,
        isValid: true,
      });
    });
  });

  it('shows a localized error when the validity update fails', async () => {
    mockUseTimekeepingSession.mockReturnValue({ activeRun: run, laps, isHydrating: false });
    mockSetLapValidity.mockReturnValue({ unwrap: () => Promise.reject(new Error('Update failed')) });
    render(<RecordedLaps />);

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('timekeeping:lapTable.markInvalid', { lapNumber: 1 }),
      }),
    );

    expect(await screen.findByText(i18n.t('timekeeping:lapTable.toggleValidityError'))).toBeInTheDocument();
  });
});
