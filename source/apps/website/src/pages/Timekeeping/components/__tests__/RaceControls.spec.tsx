// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { RUN_NOT_IN_PROGRESS_MESSAGE } from '@deepracer-indy/config';
import {
  DeviceStatus,
  DeviceType,
  LapReviewStatus,
  LapTimingSource,
  RunStatus,
  RunTransitionAction,
} from '@deepracer-indy/typescript-client';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionStatus, type TimerMqttEvent } from '#hooks/useTimerMqtt.js';
import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import { RaceControls } from '../RaceControls';

const mockTracks = [{ leaderboardId: 'leaderboard-001', fleetId: 'fleet-001', name: 'Main track' }];
const mockDevices = [
  { instanceId: 'car-001', name: 'Car 1', deviceType: DeviceType.CAR, status: DeviceStatus.ONLINE },
  { instanceId: 'car-002', name: 'Car 2', deviceType: DeviceType.CAR, status: DeviceStatus.ONLINE },
];
const TIMER_ID = 'mi-0123456789abcdef0';
const LAP_NUMBER_CONFLICT = { name: 'ConflictError', error: 'Lap number conflict. Please retry.' };
const mockTimers = [
  { instanceId: TIMER_ID, name: 'Timer 1', deviceType: DeviceType.TIMER, status: DeviceStatus.ONLINE },
];

const {
  mockGetEventQuery,
  mockAddOptimisticLap,
  mockCreateLap,
  mockSetLapValidity,
  mockListEventTracksQuery,
  mockListDevicesQuery,
  mockRemoveOptimisticLap,
  mockPublishLapCaptured,
  mockPublishOverlayUpdate,
  mockRegisterActiveRun,
  mockTransitionRunStatus,
  mockUseTimekeepingSession,
  mockUseTimerMqtt,
  mockFetchRun,
} = vi.hoisted(() => ({
  mockGetEventQuery: vi.fn(),
  mockAddOptimisticLap: vi.fn(),
  mockCreateLap: vi.fn(),
  mockSetLapValidity: vi.fn(),
  mockListEventTracksQuery: vi.fn(),
  mockListDevicesQuery: vi.fn(),
  mockRemoveOptimisticLap: vi.fn(),
  mockPublishLapCaptured: vi.fn(),
  mockPublishOverlayUpdate: vi.fn(),
  mockRegisterActiveRun: vi.fn(),
  mockTransitionRunStatus: vi.fn(),
  mockUseTimekeepingSession: vi.fn(),
  mockUseTimerMqtt: vi.fn(),
  mockFetchRun: vi.fn(),
}));

vi.mock('#hooks/useTimekeepingContext.js', () => ({
  useTimekeepingContext: () => ({ selectedEventId: 'event-001', selectedLeaderboardId: 'leaderboard-001' }),
}));

vi.mock('#hooks/useTimekeeperMqtt.js', () => ({
  useTimekeeperMqtt: () => ({
    publishLapCaptured: mockPublishLapCaptured,
    publishOverlayUpdate: mockPublishOverlayUpdate,
  }),
}));

vi.mock('#hooks/useTimerMqtt.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#hooks/useTimerMqtt.js')>()),
  useTimerMqtt: mockUseTimerMqtt,
}));

vi.mock('#services/deepRacer/devicesApi.js', () => ({
  useListDevicesQuery: mockListDevicesQuery,
}));

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useGetEventQuery: mockGetEventQuery,
  useListEventTracksQuery: mockListEventTracksQuery,
}));

vi.mock('#services/deepRacer/lapsApi.js', () => ({
  useCreateLapMutation: () => [mockCreateLap, { isLoading: false }],
  useSetLapValidityMutation: () => [mockSetLapValidity, { isLoading: false }],
}));

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useTransitionRunStatusMutation: () => [mockTransitionRunStatus, { isLoading: false }],
  useLazyGetRunQuery: () => [mockFetchRun],
}));

vi.mock('#hooks/useTimekeepingSession.js', () => ({
  useTimekeepingLaps: mockUseTimekeepingSession,
  useTimekeepingRun: mockUseTimekeepingSession,
  useTimekeepingSessionActions: mockUseTimekeepingSession,
}));

describe('<RaceControls />', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventQuery.mockReturnValue({ data: { maxTimeInMinutes: 2 } });
    mockListEventTracksQuery.mockReturnValue({ data: mockTracks, isLoading: false });
    mockListDevicesQuery.mockImplementation(({ deviceType }: { deviceType: DeviceType }) => ({
      data: deviceType === DeviceType.TIMER ? mockTimers : mockDevices,
      isLoading: false,
    }));
    mockUseTimerMqtt.mockReturnValue({ connectionStatus: ConnectionStatus.DISCONNECTED });
    mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockPublishLapCaptured.mockResolvedValue(true);
    mockPublishOverlayUpdate.mockResolvedValue(true);
    mockSetLapValidity.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockTransitionRunStatus.mockReturnValue({
      unwrap: () => Promise.resolve({ run: { runId: 'run-001', runStatus: RunStatus.IN_PROGRESS } }),
    });
    mockUseTimekeepingSession.mockReturnValue({
      activeRun: undefined,
      addOptimisticLap: mockAddOptimisticLap,
      laps: [],
      removeOptimisticLap: mockRemoveOptimisticLap,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    });
  });

  it('renders the confirmed racer as a read-only label', () => {
    mockUseTimekeepingSession.mockReturnValue({
      activeRun: undefined,
      runSetup: {
        selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
        racedByProxy: false,
      },
    });
    render(<RaceControls />);

    expect(screen.getByTestId('racer-name')).toHaveTextContent('SpeedRacer42');
    expect(screen.queryByTestId('racer-select')).not.toBeInTheDocument();
  });

  it.each([
    [RunStatus.READY, RunTransitionAction.START],
    [RunStatus.IN_PROGRESS, RunTransitionAction.PAUSE],
    [RunStatus.PAUSED, RunTransitionAction.RESUME],
  ] as const)('runs %s action from its active status', async (runStatus, action) => {
    const updatedRun = { runId: 'run-001', runStatus };
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.resolve({ run: updatedRun }) });
    mockUseTimekeepingSession.mockReturnValue({
      activeRun: { runId: 'run-001', runStatus },
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    });
    render(<RaceControls />);

    const runControl = screen.getByRole('button', { name: i18n.t(`timekeeping:actions.${action}`) });
    expect(runControl).toBeEnabled();

    fireEvent.click(runControl);

    expect(mockTransitionRunStatus).toHaveBeenCalledWith({
      action,
      eventId: 'event-001',
      leaderboardId: 'leaderboard-001',
      runId: 'run-001',
    });
    await waitFor(() => {
      expect(mockRegisterActiveRun).toHaveBeenCalledWith(updatedRun);
    });
  });

  it('publishes active and finished overlay states', async () => {
    const activeRun = { runId: 'run-001', profileId: 'profile-001', runStatus: RunStatus.IN_PROGRESS };
    const finishedRun = { ...activeRun, runStatus: RunStatus.FINISHED };
    mockUseTimekeepingSession.mockReturnValue({
      activeRun,
      laps: [],
      registerActiveRun: mockRegisterActiveRun,
      runSetup: { selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' }, racedByProxy: false },
    });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.resolve({ run: finishedRun }) });
    render(<RaceControls />);

    await waitFor(() => {
      expect(mockPublishOverlayUpdate).toHaveBeenCalledWith({
        racerName: 'SpeedRacer42',
        laps: [],
        timeLeftMilliseconds: 120000,
        currentLapTimeMilliseconds: 0,
        raceStatus: 'RACE_IN_PROGRESS',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.FINISH') }));

    await waitFor(() => {
      expect(mockPublishOverlayUpdate).toHaveBeenLastCalledWith({
        racerName: 'SpeedRacer42',
        laps: [],
        timeLeftMilliseconds: 120000,
        currentLapTimeMilliseconds: 0,
        raceStatus: 'RACE_FINISHED',
      });
    });
  });

  it.each([RunStatus.IN_PROGRESS, RunStatus.PAUSED])('finishes a %s run from End', async (runStatus) => {
    const activeRun = { runId: 'run-001', runStatus };
    const finishedRun = { ...activeRun, runStatus: RunStatus.FINISHED };
    mockUseTimekeepingSession.mockReturnValue({
      activeRun,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.resolve({ run: finishedRun }) });
    render(<RaceControls />);

    const endButton = screen.getByRole('button', { name: i18n.t('timekeeping:actions.FINISH') });
    expect(endButton).toBeEnabled();
    fireEvent.click(endButton);

    await waitFor(() => {
      expect(mockTransitionRunStatus).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-001',
        action: RunTransitionAction.FINISH,
      });
    });
    expect(mockRegisterActiveRun).toHaveBeenCalledWith(finishedRun);
  });

  it('restarts both timers from where End froze them once the run leaves FINISHED externally', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
    mockUseTimekeepingSession.mockImplementation(() => ({
      activeRun,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    }));
    mockTransitionRunStatus
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.FINISHED } }),
      });
    const { rerender } = render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);

    // Elapse 1.5s while IN_PROGRESS, then End freezes both timers via handleFinish's pauseRaceTimer().
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.FINISH') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.FINISHED };
    rerender(<RaceControls />);

    expect(screen.getByTestId('time-left')).toHaveTextContent('01:59');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:01.500');

    // Advancing time while FINISHED must not move the frozen display — mirrors PAUSED behavior.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('time-left')).toHaveTextContent('01:59');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:01.500');

    // RunsTable drives RESUME_FROM_FINISHED and re-registers the run as IN_PROGRESS externally —
    // RaceControls has no button of its own for this, so simulate that prop change directly.
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('time-left')).toHaveTextContent('01:58');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:02.500');
  });

  it('starts both timers before the START API response resolves', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const activeRun = { runId: 'run-001', runStatus: RunStatus.READY };
    let resolveStart: (value: { run: { runId: string; runStatus: RunStatus } }) => void = () => undefined;
    const startRequest = new Promise<{ run: { runId: string; runStatus: RunStatus } }>((resolve) => {
      resolveStart = resolve;
    });
    mockUseTimekeepingSession.mockReturnValue({
      activeRun,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => startRequest });
    render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('time-left')).toHaveTextContent('01:59');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:01.000');
    expect(mockRegisterActiveRun).not.toHaveBeenCalled();

    await act(async () => {
      resolveStart({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } });
      await startRequest;
    });
    expect(mockRegisterActiveRun).toHaveBeenCalledWith({ ...activeRun, runStatus: RunStatus.IN_PROGRESS });
  });

  it('pauses both timers before the PAUSE API response resolves', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
    let resolvePause: (value: { run: { runId: string; runStatus: RunStatus } }) => void = () => undefined;
    const pauseRequest = new Promise<{ run: { runId: string; runStatus: RunStatus } }>((resolve) => {
      resolvePause = resolve;
    });
    mockUseTimekeepingSession.mockImplementation(() => ({
      activeRun,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    }));
    mockTransitionRunStatus
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      })
      .mockReturnValueOnce({ unwrap: () => pauseRequest });
    const { rerender } = render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.PAUSE') }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('time-left')).toHaveTextContent('01:59');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:01.000');

    await act(async () => {
      resolvePause({ run: { ...activeRun, runStatus: RunStatus.PAUSED } });
      await pauseRequest;
    });
  });

  it('resumes both timers before the RESUME API response resolves', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
    let resolveResume: (value: { run: { runId: string; runStatus: RunStatus } }) => void = () => undefined;
    const resumeRequest = new Promise<{ run: { runId: string; runStatus: RunStatus } }>((resolve) => {
      resolveResume = resolve;
    });
    mockUseTimekeepingSession.mockImplementation(() => ({
      activeRun,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    }));
    mockTransitionRunStatus
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      })
      .mockReturnValueOnce({ unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.PAUSED } }) })
      .mockReturnValueOnce({ unwrap: () => resumeRequest });
    const { rerender } = render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.PAUSE') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.PAUSED };
    rerender(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.RESUME') }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('time-left')).toHaveTextContent('01:58');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:02.000');

    await act(async () => {
      resolveResume({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } });
      await resumeRequest;
    });
  });

  it('enables Record lap after Start and persists the current lap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
    mockUseTimekeepingSession.mockImplementation(() => ({
      activeRun,
      addOptimisticLap: mockAddOptimisticLap,
      laps: [],
      removeOptimisticLap: mockRemoveOptimisticLap,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    }));
    mockTransitionRunStatus.mockReturnValue({
      unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
    });
    const { rerender } = render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const recordLapButton = screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') });
    expect(recordLapButton).toBeEnabled();

    fireEvent.click(recordLapButton);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAddOptimisticLap).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-001',
        leaderboardId: 'leaderboard-001',
        lapNumber: 1,
        lapTimeMs: 1500,
        isValid: true,
        resets: 0,
      }),
    );
    expect(mockCreateLap).toHaveBeenCalledWith({
      eventId: 'event-001',
      leaderboardId: 'leaderboard-001',
      runId: 'run-001',
      deviceId: undefined,
      lapTimeMs: 1500,
      resets: 0,
      timingSource: LapTimingSource.MANUAL,
      clientToken: expect.any(String),
    });
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
    expect(mockPublishLapCaptured).toHaveBeenCalledWith({
      lapNumber: 1,
      lapTimeMilliseconds: 1500,
      isValid: true,
      resets: 0,
    });
  });

  it('records an invalid lap, restores time left, and pauses the run', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
    mockUseTimekeepingSession.mockImplementation(() => ({
      activeRun,
      addOptimisticLap: mockAddOptimisticLap,
      laps: [],
      removeOptimisticLap: mockRemoveOptimisticLap,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    }));
    mockTransitionRunStatus
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      })
      .mockReturnValueOnce({ unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.PAUSED } }) });
    mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({ lapNumber: 1 }) });
    const { rerender } = render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.markLapInvalid') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAddOptimisticLap).toHaveBeenCalledWith(
      expect.objectContaining({ lapNumber: 1, lapTimeMs: 1500, isValid: false, resets: 0 }),
    );
    expect(mockCreateLap).toHaveBeenCalledWith(expect.objectContaining({ lapTimeMs: 1500, resets: 0 }));
    expect(mockSetLapValidity).toHaveBeenCalledWith({
      eventId: 'event-001',
      leaderboardId: 'leaderboard-001',
      runId: 'run-001',
      lapNumber: 1,
      isValid: false,
    });
    expect(mockTransitionRunStatus).toHaveBeenLastCalledWith({
      eventId: 'event-001',
      leaderboardId: 'leaderboard-001',
      runId: 'run-001',
      action: RunTransitionAction.PAUSE,
    });
    expect(mockRegisterActiveRun).toHaveBeenLastCalledWith({ ...activeRun, runStatus: RunStatus.PAUSED });
    expect(screen.getByTestId('time-left')).toHaveTextContent('02:00');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
  });

  it('records an invalid lap and pauses without restoring time left for Did not finish', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
    mockUseTimekeepingSession.mockImplementation(() => ({
      activeRun,
      addOptimisticLap: mockAddOptimisticLap,
      laps: [],
      removeOptimisticLap: mockRemoveOptimisticLap,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    }));
    mockTransitionRunStatus
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      })
      .mockReturnValueOnce({ unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.PAUSED } }) });
    mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({ lapNumber: 1 }) });
    const { rerender } = render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
    rerender(<RaceControls />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.didNotFinish') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAddOptimisticLap).toHaveBeenCalledWith(
      expect.objectContaining({ lapNumber: 1, lapTimeMs: 1500, isValid: false, resets: 0 }),
    );
    expect(mockSetLapValidity).toHaveBeenCalledWith(expect.objectContaining({ lapNumber: 1, isValid: false }));
    expect(mockTransitionRunStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: RunTransitionAction.PAUSE }),
    );
    expect(mockRegisterActiveRun).toHaveBeenLastCalledWith({ ...activeRun, runStatus: RunStatus.PAUSED });
    expect(screen.getByTestId('time-left')).toHaveTextContent('01:59');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
  });

  it.each(['validity', 'pause'] as const)(
    'surfaces an error without removing the persisted invalid lap when %s fails',
    async (failureStep) => {
      const expectedLastAction = failureStep === 'validity' ? RunTransitionAction.START : RunTransitionAction.PAUSE;
      const expectedTransitionCalls = failureStep === 'validity' ? 1 : 2;
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
      mockUseTimekeepingSession.mockImplementation(() => ({
        activeRun,
        addOptimisticLap: mockAddOptimisticLap,
        laps: [],
        removeOptimisticLap: mockRemoveOptimisticLap,
        registerActiveRun: mockRegisterActiveRun,
        runSetup: undefined,
      }));
      mockTransitionRunStatus
        .mockReturnValueOnce({
          unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
        })
        .mockReturnValueOnce({
          unwrap: () =>
            failureStep === 'pause'
              ? Promise.reject(new Error('Pause failed'))
              : Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.PAUSED } }),
        });
      mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({ lapNumber: 1 }) });
      mockSetLapValidity.mockReturnValue({
        unwrap: () => (failureStep === 'validity' ? Promise.reject(new Error('Validity failed')) : Promise.resolve({})),
      });
      const { rerender } = render(<RaceControls />);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.markLapInvalid') }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockAddOptimisticLap).toHaveBeenCalledWith(expect.objectContaining({ isValid: false }));
      expect(mockRemoveOptimisticLap).not.toHaveBeenCalled();
      expect(screen.getByText(i18n.t('timekeeping:manualTiming.markLapInvalidError'))).toBeInTheDocument();
      expect(mockTransitionRunStatus).toHaveBeenCalledTimes(expectedTransitionCalls);
      expect(mockTransitionRunStatus).toHaveBeenLastCalledWith(expect.objectContaining({ action: expectedLastAction }));
    },
  );

  it.each(['manualTiming.didNotFinish', 'manualTiming.markLapInvalid'] as const)(
    'freezes the clocks optimistically before %s resolves',
    async (buttonKey) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
      mockUseTimekeepingSession.mockImplementation(() => ({
        activeRun,
        addOptimisticLap: mockAddOptimisticLap,
        laps: [],
        removeOptimisticLap: mockRemoveOptimisticLap,
        registerActiveRun: mockRegisterActiveRun,
        runSetup: undefined,
      }));
      mockTransitionRunStatus.mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      });
      let resolveCreateLap: (value: { lapNumber: number }) => void = () => undefined;
      const createLapRequest = new Promise<{ lapNumber: number }>((resolve) => {
        resolveCreateLap = resolve;
      });
      mockCreateLap.mockReturnValue({ unwrap: () => createLapRequest });
      const { rerender } = render(<RaceControls />);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t(`timekeeping:${buttonKey}`) }));

      // The CreateLap/SetLapValidity/PAUSE round-trip is still in flight (createLapRequest is
      // unresolved), yet the clocks must already be frozen — this is the optimistic pause.
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
      const frozenTimeLeft = screen.getByTestId('time-left').textContent;

      await act(async () => {
        resolveCreateLap({ lapNumber: 1 });
        await createLapRequest;
        await Promise.resolve();
        await Promise.resolve();
      });

      // Resolving the in-flight request must not have caused the frozen display to jump.
      expect(screen.getByTestId('time-left')).toHaveTextContent(frozenTimeLeft ?? '');
      expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
    },
  );

  it.each([
    ['manualTiming.didNotFinish', 'didNotFinishError'],
    ['manualTiming.markLapInvalid', 'markLapInvalidError'],
  ] as const)(
    'resumes the clocks after rolling back an optimistic pause when %s fails',
    async (buttonKey, errorKey) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      let activeRun: { runId: string; runStatus: RunStatus } = { runId: 'run-001', runStatus: RunStatus.READY };
      mockUseTimekeepingSession.mockImplementation(() => ({
        activeRun,
        addOptimisticLap: mockAddOptimisticLap,
        laps: [],
        removeOptimisticLap: mockRemoveOptimisticLap,
        registerActiveRun: mockRegisterActiveRun,
        runSetup: undefined,
      }));
      mockTransitionRunStatus.mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      });
      mockCreateLap.mockReturnValue({ unwrap: () => Promise.reject(new Error('Create failed')) });
      const { rerender } = render(<RaceControls />);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t(`timekeeping:${buttonKey}`) }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText(i18n.t(`timekeeping:manualTiming.${errorKey}`))).toBeInTheDocument();
      expect(mockRemoveOptimisticLap).toHaveBeenCalled();
      expect(mockTransitionRunStatus).toHaveBeenCalledTimes(1);

      // The optimistic pause must have been rolled back — both clocks resume ticking from where
      // they were frozen (1500ms elapsed pre-click), not from zero.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('current-lap')).toHaveTextContent('00:02.500');
    },
  );

  it('rolls back optimistic timers when START fails', async () => {
    vi.useFakeTimers();
    const activeRun = { runId: 'run-001', runStatus: RunStatus.READY };
    mockUseTimekeepingSession.mockReturnValue({
      activeRun,
      registerActiveRun: mockRegisterActiveRun,
      runSetup: undefined,
    });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.reject(new Error('START failed')) });
    render(<RaceControls />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('time-left')).toHaveTextContent('02:00');
    expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
    expect(mockRegisterActiveRun).not.toHaveBeenCalled();
  });

  it.each([RunStatus.FINISHED, RunStatus.SUBMITTED, RunStatus.DISCARDED] as const)(
    'disables the run control for %s',
    (runStatus) => {
      mockUseTimekeepingSession.mockReturnValue({
        activeRun: { runId: 'run-001', runStatus },
        registerActiveRun: mockRegisterActiveRun,
        runSetup: undefined,
      });
      render(<RaceControls />);

      expect(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') })).toBeDisabled();
    },
  );

  it('increments the local reset count for an in-progress run', () => {
    mockUseTimekeepingSession.mockReturnValue({
      activeRun: { runId: 'run-001', runStatus: RunStatus.IN_PROGRESS },
      runSetup: undefined,
    });
    render(<RaceControls />);

    const carResetButton = screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.carReset') });
    const resetCountResetButton = screen.getByRole('button', { name: '-1' });
    expect(carResetButton).toBeEnabled();
    expect(resetCountResetButton).toBeDisabled();
    expect(screen.getByTestId('reset-count')).toHaveTextContent(
      `0/${i18n.t('timekeeping:manualTiming.unlimitedResets')}`,
    );

    fireEvent.click(carResetButton);

    expect(resetCountResetButton).toBeEnabled();
    expect(screen.getByTestId('reset-count')).toHaveTextContent(
      `1/${i18n.t('timekeeping:manualTiming.unlimitedResets')}`,
    );

    fireEvent.click(resetCountResetButton);

    expect(resetCountResetButton).toBeDisabled();
    expect(screen.getByTestId('reset-count')).toHaveTextContent(
      `0/${i18n.t('timekeeping:manualTiming.unlimitedResets')}`,
    );
  });

  it('renders and selects online cars for the selected track fleet', () => {
    mockUseTimekeepingSession.mockReturnValue({
      activeRun: { runStatus: RunStatus.READY },
      runSetup: undefined,
    });
    render(<RaceControls />);

    expect(mockListDevicesQuery).toHaveBeenCalledWith(
      { deviceType: DeviceType.CAR, status: DeviceStatus.ONLINE, fleetId: 'fleet-001' },
      { skip: false },
    );

    const carSelect = createWrapper().findSelect('[data-testid="car-select"]');
    expect(carSelect).not.toBeNull();

    carSelect?.openDropdown();
    expect(screen.getByText('Car 1')).toBeInTheDocument();
    expect(screen.getByText('Car 2')).toBeInTheDocument();

    carSelect?.selectOptionByValue('car-001');
    expect(carSelect?.findTrigger().getElement()).toHaveTextContent('Car 1');
  });

  describe('automatic timing', () => {
    let emitTimerEvent: (event: TimerMqttEvent) => void;
    let activeRun: { runId: string; runStatus: RunStatus };
    let nextSequence: number;

    /** A crossing at `timestamp` on the timer clock; sequence numbers increase by one unless given. */
    const lap = (timestamp: number, sequence = nextSequence++): TimerMqttEvent => ({
      eventType: 'TIMER_LAP',
      instanceId: TIMER_ID,
      timestamp,
      gpio: 17,
      sequence,
    });
    const flush = async () => {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    const selectTimer = () => {
      const timerSelect = createWrapper().findSelect('[data-testid="timer-select"]');
      timerSelect?.openDropdown();
      timerSelect?.selectOptionByValue(TIMER_ID);
    };
    const selectAutoMode = () => {
      createWrapper().findSegmentedControl('[data-testid="timing-mode"]')?.findSegmentById('AUTO')?.click();
    };

    beforeEach(() => {
      nextSequence = 1;
      activeRun = { runId: 'run-001', runStatus: RunStatus.READY };
      mockUseTimekeepingSession.mockImplementation(() => ({
        activeRun,
        addOptimisticLap: mockAddOptimisticLap,
        laps: [],
        removeOptimisticLap: mockRemoveOptimisticLap,
        registerActiveRun: mockRegisterActiveRun,
        runSetup: undefined,
      }));
      mockTransitionRunStatus.mockImplementation(() => ({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.IN_PROGRESS } }),
      }));
      mockUseTimerMqtt.mockImplementation((_instanceId: string, { onEvent }: { onEvent: typeof emitTimerEvent }) => {
        emitTimerEvent = onEvent;
        return { connectionStatus: ConnectionStatus.CONNECTED };
      });
    });

    it('lists online timers and only allows Automatic once a timer is selected', () => {
      render(<RaceControls />);

      expect(mockListDevicesQuery).toHaveBeenCalledWith(
        { deviceType: DeviceType.TIMER, status: DeviceStatus.ONLINE },
        { skip: false },
      );
      const autoSegment = createWrapper()
        .findSegmentedControl('[data-testid="timing-mode"]')
        ?.findSegmentById('AUTO')
        ?.getElement();
      expect(autoSegment).toBeDisabled();

      selectTimer();

      expect(mockUseTimerMqtt).toHaveBeenLastCalledWith(TIMER_ID, expect.anything());
      expect(autoSegment).toBeEnabled();
    });

    it('reports the timer online after a heartbeat and not responding before one', () => {
      render(<RaceControls />);
      selectTimer();

      expect(screen.getByTestId('timer-status')).toHaveTextContent(
        i18n.t('timekeeping:autoTiming.status.notResponding'),
      );

      act(() => emitTimerEvent({ eventType: 'TIMER_HEARTBEAT', instanceId: TIMER_ID, timestamp: 1 }));

      expect(screen.getByTestId('timer-status')).toHaveTextContent(i18n.t('timekeeping:autoTiming.status.online'));
    });

    it.each([
      [ConnectionStatus.CONNECTING, 'autoTiming.status.connecting'],
      [ConnectionStatus.DISCONNECTED, 'autoTiming.status.connecting'],
      [ConnectionStatus.ERROR, 'autoTiming.status.connectionError'],
    ] as const)('reports the timer status when the MQTT connection is %s', (connectionStatus, statusKey) => {
      mockUseTimerMqtt.mockReturnValue({ connectionStatus });
      render(<RaceControls />);
      selectTimer();

      expect(screen.getByTestId('timer-status')).toHaveTextContent(i18n.t(`timekeeping:${statusKey}`));
    });

    it('ignores events from a timer other than the selected one', async () => {
      render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent({ ...lap(1000), instanceId: 'mi-ffffffffffffffff0' }));
      await flush();

      expect(mockTransitionRunStatus).not.toHaveBeenCalled();
      expect(screen.getByTestId('timer-status')).toHaveTextContent(
        i18n.t('timekeeping:autoTiming.status.notResponding'),
      );
    });

    it('switches back to Manual and stops acting on crossings', async () => {
      render(<RaceControls />);
      selectTimer();
      selectAutoMode();
      createWrapper().findSegmentedControl('[data-testid="timing-mode"]')?.findSegmentById('MANUAL')?.click();

      act(() => emitTimerEvent(lap(1000)));
      await flush();

      expect(mockTransitionRunStatus).not.toHaveBeenCalled();
    });

    it('ignores crossings in Manual mode', async () => {
      render(<RaceControls />);
      selectTimer();

      act(() => emitTimerEvent(lap(1000)));
      await flush();

      expect(mockTransitionRunStatus).not.toHaveBeenCalled();
    });

    it('starts the run on the first crossing and records the next lap from the timer clock', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const { rerender } = render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(1_000)));
      await flush();
      expect(mockTransitionRunStatus).toHaveBeenCalledWith(
        expect.objectContaining({ action: RunTransitionAction.START }),
      );
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(14_000);
      });

      act(() => emitTimerEvent(lap(13_500)));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledWith(
        expect.objectContaining({
          lapTimeMs: 12_500,
          timingSource: LapTimingSource.AUTO,
          missedCrossings: 0,
          clientToken: `${TIMER_ID}::2:13500`,
        }),
      );
      expect(mockAddOptimisticLap).toHaveBeenCalledWith(
        expect.objectContaining({
          lapTimeMs: 12_500,
          isValid: true,
          timingSource: LapTimingSource.AUTO,
          reviewStatus: LapReviewStatus.NOT_REQUIRED,
        }),
      );
    });

    it('flags an out-of-range auto lap for review and ignores a redelivered crossing', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const { rerender } = render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(1_000)));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(3_000);
      });

      act(() => emitTimerEvent(lap(2_500, 2)));
      await flush();
      act(() => emitTimerEvent(lap(2_500, 2)));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledTimes(1);
      expect(mockAddOptimisticLap).toHaveBeenCalledWith(
        expect.objectContaining({ lapTimeMs: 1_500, isValid: false, reviewStatus: LapReviewStatus.PENDING_REVIEW }),
      );
      expect(mockPublishLapCaptured).toHaveBeenCalledWith(expect.objectContaining({ isValid: false }));
    });

    it('records a lap after a manual Record lap as MANUAL, timed on the browser clock', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const { rerender } = render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(1_000)));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') }));
      await flush();
      act(() => {
        vi.advanceTimersByTime(8_000);
      });

      act(() => emitTimerEvent(lap(30_000)));
      await flush();

      expect(mockCreateLap).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ lapTimeMs: 10_000, timingSource: LapTimingSource.MANUAL }),
      );
      expect(mockCreateLap).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          lapTimeMs: 8_000,
          timingSource: LapTimingSource.MANUAL,
          clientToken: `${TIMER_ID}::2:30000`,
        }),
      );
      expect(mockCreateLap.mock.calls[1][0]).not.toHaveProperty('missedCrossings');
    });

    it('flags an auto lap for review when the timer lost a crossing', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const { rerender } = render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(1_000, 1)));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(50_000);
      });

      // Crossing 2 never arrived, so this "lap" likely spans two laps despite a plausible time.
      act(() => emitTimerEvent(lap(49_000, 3)));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledWith(
        expect.objectContaining({ lapTimeMs: 48_000, missedCrossings: 1, timingSource: LapTimingSource.AUTO }),
      );
      expect(mockAddOptimisticLap).toHaveBeenCalledWith(
        expect.objectContaining({ isValid: false, reviewStatus: LapReviewStatus.PENDING_REVIEW }),
      );
    });

    it('records a crossing once when two Timekeeping pages receive it', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      // The backend's idempotency guard accepts the first CreateLap for a token and rejects the
      // replay with ConflictError.
      const recordedTokens = new Set<string>();
      mockCreateLap.mockImplementation(({ clientToken }: { clientToken: string }) => ({
        unwrap: () => {
          if (recordedTokens.has(clientToken)) return Promise.reject(LAP_NUMBER_CONFLICT);
          recordedTokens.add(clientToken);
          return Promise.resolve({});
        },
      }));
      const startCrossing = lap(1_000);
      const lapCrossing = lap(13_000);
      // Each facilitator page receives the same two crossings from the timer.
      const runPage = async () => {
        activeRun = { runId: 'run-001', runStatus: RunStatus.READY };
        const view = render(<RaceControls />);
        selectTimer();
        selectAutoMode();
        act(() => emitTimerEvent(startCrossing));
        await flush();
        activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
        view.rerender(<RaceControls />);
        act(() => {
          vi.advanceTimersByTime(12_000);
        });
        act(() => emitTimerEvent(lapCrossing));
        await flush();
        return view;
      };

      (await runPage()).unmount();
      await runPage();

      // First page: one call. Second page: the replay conflicts, and so does its one retry.
      expect(mockCreateLap).toHaveBeenCalledTimes(3);
      const tokens = mockCreateLap.mock.calls.map(([input]) => (input as { clientToken: string }).clientToken);
      expect(new Set(tokens).size).toBe(1);
      expect(recordedTokens.size).toBe(1);
      // The second page's CreateLap was the replay: it drops its optimistic lap without an error.
      expect(mockRemoveOptimisticLap).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(i18n.t('timekeeping:manualTiming.lapError'))).not.toBeInTheDocument();
    });

    /** Drives the page to an in-progress run whose lap is timed between two crossings. */
    const recordCrossingLap = async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const view = render(<RaceControls />);
      selectTimer();
      selectAutoMode();
      act(() => emitTimerEvent(lap(1_000)));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      view.rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(12_000);
      });
      act(() => emitTimerEvent(lap(13_000)));
      await flush();
      await flush();
    };

    it('retries a crossing lap that lost a lap-count race and records it', async () => {
      mockCreateLap
        .mockReturnValueOnce({ unwrap: () => Promise.reject(LAP_NUMBER_CONFLICT) })
        .mockReturnValueOnce({ unwrap: () => Promise.resolve({}) });

      await recordCrossingLap();

      expect(mockCreateLap).toHaveBeenCalledTimes(2);
      expect(mockCreateLap.mock.calls[1][0]).toEqual(mockCreateLap.mock.calls[0][0]);
      expect(mockCreateLap.mock.calls[1][0]).toEqual(
        expect.objectContaining({ clientToken: `${TIMER_ID}::2:13000`, lapTimeMs: 12_000 }),
      );
      expect(mockRemoveOptimisticLap).not.toHaveBeenCalled();
      expect(mockPublishLapCaptured).toHaveBeenCalledWith(expect.objectContaining({ lapTimeMilliseconds: 12_000 }));
      expect(screen.queryByText(i18n.t('timekeeping:manualTiming.lapError'))).not.toBeInTheDocument();
    });

    it('reports a crossing that arrived after the run stopped instead of dropping it silently', async () => {
      mockCreateLap.mockReturnValue({
        unwrap: () => Promise.reject({ name: 'ConflictError', error: RUN_NOT_IN_PROGRESS_MESSAGE }),
      });

      await recordCrossingLap();

      expect(mockCreateLap).toHaveBeenCalledTimes(1);
      expect(mockRemoveOptimisticLap).toHaveBeenCalledTimes(1);
      expect(screen.getByText(i18n.t('timekeeping:autoTiming.crossingNotRecorded'))).toBeInTheDocument();
    });

    it('does not retry a manual lap on a lap-number conflict', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      mockCreateLap.mockReturnValue({ unwrap: () => Promise.reject(LAP_NUMBER_CONFLICT) });
      activeRun = { runId: 'run-001', runStatus: RunStatus.READY };
      const view = render(<RaceControls />);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      view.rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(5_000);
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') }));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledTimes(1);
      expect(screen.getByText(i18n.t('timekeeping:manualTiming.lapError'))).toBeInTheDocument();
    });

    it('restarts the lap clock when a crossing resumes a run paused mid-lap', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const view = render(<RaceControls />);
      selectTimer();
      selectAutoMode();
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      view.rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      mockTransitionRunStatus.mockImplementationOnce(() => ({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.PAUSED } }),
      }));
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.PAUSE') }));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.PAUSED };
      view.rerender(<RaceControls />);
      expect(screen.getByTestId('current-lap')).toHaveTextContent('00:05.000');

      act(() => emitTimerEvent(lap(20_000)));
      await flush();

      expect(mockTransitionRunStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: RunTransitionAction.RESUME }),
      );
      expect(screen.getByTestId('current-lap')).toHaveTextContent('00:00.000');
    });

    it('restores the part-lap when a crossing could not resume the run', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const view = render(<RaceControls />);
      selectTimer();
      selectAutoMode();
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      view.rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      mockTransitionRunStatus.mockImplementationOnce(() => ({
        unwrap: () => Promise.resolve({ run: { ...activeRun, runStatus: RunStatus.PAUSED } }),
      }));
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.PAUSE') }));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.PAUSED };
      view.rerender(<RaceControls />);

      // The crossing's RESUME is rejected and the server run is still paused.
      mockTransitionRunStatus.mockImplementationOnce(() => ({
        unwrap: () => Promise.reject({ name: 'ConflictError', error: 'Concurrent transition detected; please retry.' }),
      }));
      mockFetchRun.mockReturnValue({ unwrap: () => Promise.resolve({ run: activeRun, laps: [] }) });
      act(() => emitTimerEvent(lap(20_000)));
      await flush();
      await flush();
      expect(screen.getByTestId('current-lap')).toHaveTextContent('00:05.000');

      // A manual Resume continues the part-lap, so the recorded lap covers both halves.
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.RESUME') }));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      view.rerender(<RaceControls />);
      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') }));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledWith(
        expect.objectContaining({ lapTimeMs: 8_000, timingSource: LapTimingSource.MANUAL }),
      );
    });

    it('keeps timing when another page already started the run from the same crossing', async () => {
      mockTransitionRunStatus.mockReturnValue({
        unwrap: () => Promise.reject({ name: 'BadRequestError', error: 'Cannot apply action START' }),
      });
      const serverRun = { runId: 'run-001', runStatus: RunStatus.IN_PROGRESS };
      mockFetchRun.mockReturnValue({ unwrap: () => Promise.resolve({ run: serverRun, laps: [] }) });
      render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(1_000)));
      await flush();
      await flush();

      expect(mockFetchRun).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-001',
      });
      expect(mockRegisterActiveRun).toHaveBeenCalledWith(serverRun);
      expect(screen.queryByText(i18n.t('timekeeping:autoTiming.crossingTransitionFailed'))).not.toBeInTheDocument();
    });

    it('rolls back and explains when a crossing could not start the run', async () => {
      mockTransitionRunStatus.mockReturnValue({
        unwrap: () => Promise.reject({ name: 'ConflictError', error: 'Concurrent transition detected; please retry.' }),
      });
      mockFetchRun.mockReturnValue({
        unwrap: () => Promise.resolve({ run: { runId: 'run-001', runStatus: RunStatus.READY }, laps: [] }),
      });
      render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(1_000)));
      await flush();
      await flush();

      expect(mockRegisterActiveRun).not.toHaveBeenCalled();
      expect(screen.getByText(i18n.t('timekeeping:autoTiming.crossingTransitionFailed'))).toBeInTheDocument();
    });

    it('does not check the server when a manual Start fails', async () => {
      mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.reject({ name: 'ConflictError' }) });
      render(<RaceControls />);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') }));
      await flush();

      expect(mockFetchRun).not.toHaveBeenCalled();
      expect(screen.queryByText(i18n.t('timekeeping:autoTiming.crossingTransitionFailed'))).not.toBeInTheDocument();
    });

    const bootLap = (bootId: string, sequence: number, timestamp: number, publishedAt?: number): TimerMqttEvent => ({
      eventType: 'TIMER_LAP',
      instanceId: TIMER_ID,
      bootId,
      timestamp,
      gpio: 17,
      sequence,
      ...(publishedAt !== undefined && { publishedAt }),
    });
    const advance = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    };
    /** Starts the run with a crossing at timer time 1 000 ms (sequence 1 of boot-a). */
    const startRunFromCrossing = async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const view = render(<RaceControls />);
      selectTimer();
      selectAutoMode();
      act(() => emitTimerEvent(bootLap('boot-a', 1, 1_000)));
      await flush();
      activeRun = { ...activeRun, runStatus: RunStatus.IN_PROGRESS };
      view.rerender(<RaceControls />);
      return view;
    };

    it('flags the lap that spans a timer restart and times it on the browser clock', async () => {
      await startRunFromCrossing();
      await advance(20_000);

      // The restarted timer has a new bootId, restarts its sequence and its clock reads lower.
      act(() => emitTimerEvent(bootLap('boot-b', 1, 500)));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledWith(
        expect.objectContaining({
          lapTimeMs: 20_000,
          timingSource: LapTimingSource.MANUAL,
          missedCrossings: 1,
          clientToken: `${TIMER_ID}:boot-b:1:500`,
        }),
      );
      expect(mockAddOptimisticLap).toHaveBeenCalledWith(
        expect.objectContaining({ isValid: false, reviewStatus: LapReviewStatus.PENDING_REVIEW }),
      );
    });

    it('times laps on the new timer clock after a restart', async () => {
      await startRunFromCrossing();
      await advance(20_000);
      act(() => emitTimerEvent(bootLap('boot-b', 1, 500)));
      await flush();
      await advance(12_000);

      act(() => emitTimerEvent(bootLap('boot-b', 2, 12_500)));
      await flush();

      expect(mockCreateLap).toHaveBeenLastCalledWith(
        expect.objectContaining({ lapTimeMs: 12_000, timingSource: LapTimingSource.AUTO, missedCrossings: 0 }),
      );
    });

    it('ignores an older crossing delivered out of order, so the next lap is not flagged', async () => {
      await startRunFromCrossing();
      await advance(24_000);
      act(() => emitTimerEvent(bootLap('boot-a', 3, 25_000))); // crossing 2 hasn't arrived yet
      await flush();
      act(() => emitTimerEvent(bootLap('boot-a', 2, 13_000))); // late copy of crossing 2
      await flush();
      await advance(12_000);

      act(() => emitTimerEvent(bootLap('boot-a', 4, 37_000)));
      await flush();

      expect(mockCreateLap).toHaveBeenCalledTimes(2);
      expect(mockCreateLap).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ lapTimeMs: 24_000, missedCrossings: 1 }),
      );
      expect(mockCreateLap).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ lapTimeMs: 12_000, timingSource: LapTimingSource.AUTO, missedCrossings: 0 }),
      );
    });

    it.each([
      [5_000, false],
      [100, true],
    ])('starts the run from a crossing published %i ms after it happened: %s', async (delayMs, starts) => {
      render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(bootLap('boot-a', 1, 1_000, 1_000 + delayMs)));
      await flush();

      expect(mockTransitionRunStatus).toHaveBeenCalledTimes(starts ? 1 : 0);
    });

    it('retries a crossing lap after a server error with the same token', async () => {
      await startRunFromCrossing();
      mockCreateLap
        .mockReturnValueOnce({ unwrap: () => Promise.reject({ name: 'InternalFailureError', fault: 'server' }) })
        .mockReturnValueOnce({ unwrap: () => Promise.resolve({}) });
      await advance(12_000);

      act(() => emitTimerEvent(bootLap('boot-a', 2, 13_000)));
      await flush();
      await advance(500);

      expect(mockCreateLap).toHaveBeenCalledTimes(2);
      expect(mockCreateLap.mock.calls[1][0]).toEqual(mockCreateLap.mock.calls[0][0]);
      expect(mockRemoveOptimisticLap).not.toHaveBeenCalled();
    });

    it('measures and flags the next lap across a crossing lap that could not be recorded', async () => {
      await startRunFromCrossing();
      mockCreateLap.mockReturnValue({ unwrap: () => Promise.reject({ name: 'TypeError', error: 'Failed to fetch' }) });
      await advance(12_000);
      act(() => emitTimerEvent(bootLap('boot-a', 2, 13_000)));
      await flush();
      await advance(500);
      await advance(1_500);
      expect(mockCreateLap).toHaveBeenCalledTimes(3);
      expect(screen.getByText(i18n.t('timekeeping:manualTiming.lapError'))).toBeInTheDocument();

      mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({}) });
      await advance(10_000);
      act(() => emitTimerEvent(bootLap('boot-a', 3, 25_000)));
      await flush();

      expect(mockCreateLap).toHaveBeenLastCalledWith(
        expect.objectContaining({ lapTimeMs: 24_000, timingSource: LapTimingSource.AUTO, missedCrossings: 1 }),
      );
    });

    /** Records crossing lap 2 at timer time 13 000 ms, whose CreateLap keeps failing. */
    const loseCrossingLap = async () => {
      mockCreateLap.mockReturnValue({ unwrap: () => Promise.reject({ name: 'TypeError', error: 'Failed to fetch' }) });
      await advance(12_000);
      act(() => emitTimerEvent(bootLap('boot-a', 2, 13_000)));
      await flush();
      await advance(500);
      await advance(1_500);
      mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    };

    it('flags the manual lap that covers a lost crossing lap, not the next crossing lap', async () => {
      await startRunFromCrossing();
      await loseCrossingLap();
      await advance(10_000);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') }));
      await flush();
      expect(mockCreateLap).toHaveBeenLastCalledWith(
        // 12 s to the lost crossing, 2 s of retries, then 10 s more on the rolled-back lap clock.
        expect.objectContaining({ lapTimeMs: 24_000, timingSource: LapTimingSource.MANUAL, missedCrossings: 1 }),
      );

      await advance(8_000);
      act(() => emitTimerEvent(bootLap('boot-a', 3, 31_000)));
      await flush();

      expect(mockCreateLap).toHaveBeenLastCalledWith(
        expect.objectContaining({ lapTimeMs: 8_000, timingSource: LapTimingSource.MANUAL }),
      );
      expect(mockCreateLap.mock.lastCall?.[0]).not.toHaveProperty('missedCrossings');
    });

    it('keeps the flag for the retry when the manual lap covering a lost crossing lap also fails', async () => {
      await startRunFromCrossing();
      await loseCrossingLap();
      await advance(10_000);
      mockCreateLap.mockReturnValueOnce({
        unwrap: () => Promise.reject({ name: 'TypeError', error: 'Failed to fetch' }),
      });
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') }));
      await flush();
      expect(screen.getByText(i18n.t('timekeeping:manualTiming.lapError'))).toBeInTheDocument();

      await advance(1_000);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:manualTiming.recordLap') }));
      await flush();

      expect(mockCreateLap).toHaveBeenLastCalledWith(
        // The failed manual lap rolled the lap clock back, so the retry still covers the lost lap.
        expect.objectContaining({ lapTimeMs: 25_000, timingSource: LapTimingSource.MANUAL, missedCrossings: 1 }),
      );
    });

    it('still flags the next lap after switching mode, since the lap clock still covers the lost lap', async () => {
      await startRunFromCrossing();
      await loseCrossingLap();
      const modes = createWrapper().findSegmentedControl('[data-testid="timing-mode"]');
      modes?.findSegmentById('MANUAL')?.click();
      modes?.findSegmentById('AUTO')?.click();
      await advance(10_000);

      act(() => emitTimerEvent(bootLap('boot-a', 3, 25_000)));
      await flush();

      expect(mockCreateLap).toHaveBeenLastCalledWith(
        // 12 s to the lost crossing, 2 s of retries, then 10 s more on the rolled-back lap clock.
        expect.objectContaining({ lapTimeMs: 24_000, timingSource: LapTimingSource.MANUAL, missedCrossings: 1 }),
      );
    });

    it('resumes a paused run on a crossing without recording a lap', async () => {
      activeRun = { runId: 'run-001', runStatus: RunStatus.PAUSED };
      render(<RaceControls />);
      selectTimer();
      selectAutoMode();

      act(() => emitTimerEvent(lap(5_000)));
      await flush();

      expect(mockTransitionRunStatus).toHaveBeenCalledWith(
        expect.objectContaining({ action: RunTransitionAction.RESUME }),
      );
      expect(mockCreateLap).not.toHaveBeenCalled();
    });
  });
});
