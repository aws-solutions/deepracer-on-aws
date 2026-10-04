// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { DeviceStatus, DeviceType, RunStatus, RunTransitionAction } from '@deepracer-indy/typescript-client';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import { RaceControls } from '../RaceControls';

const mockTracks = [{ leaderboardId: 'leaderboard-001', fleetId: 'fleet-001', name: 'Main track' }];
const mockDevices = [
  { instanceId: 'car-001', name: 'Car 1', deviceType: DeviceType.CAR, status: DeviceStatus.ONLINE },
  { instanceId: 'car-002', name: 'Car 2', deviceType: DeviceType.CAR, status: DeviceStatus.ONLINE },
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
  mockStartCarLogFetch,
  mockTransitionRunStatus,
  mockUseTimekeepingSession,
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
  mockStartCarLogFetch: vi.fn(),
  mockTransitionRunStatus: vi.fn(),
  mockUseTimekeepingSession: vi.fn(),
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('#hooks/useTimekeepingContext.js', () => ({
  useTimekeepingContext: () => ({
    fetchCarLogsOnRunFinish: false,
    selectedEventId: 'event-001',
    selectedLeaderboardId: 'leaderboard-001',
  }),
}));

vi.mock('#hooks/useTimekeeperMqtt.js', () => ({
  useTimekeeperMqtt: () => ({
    publishLapCaptured: mockPublishLapCaptured,
    publishOverlayUpdate: mockPublishOverlayUpdate,
  }),
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

vi.mock('#services/deepRacer/carLogsApi.js', () => ({
  useStartCarLogFetchMutation: () => [mockStartCarLogFetch, { isLoading: false }],
}));

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useTransitionRunStatusMutation: () => [mockTransitionRunStatus, { isLoading: false }],
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
    mockListDevicesQuery.mockReturnValue({ data: mockDevices, isLoading: false });
    mockCreateLap.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockPublishLapCaptured.mockResolvedValue(true);
    mockPublishOverlayUpdate.mockResolvedValue(true);
    mockSetLapValidity.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockStartCarLogFetch.mockReturnValue({ unwrap: () => Promise.resolve({ jobId: 'job-001' }) });
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
});
