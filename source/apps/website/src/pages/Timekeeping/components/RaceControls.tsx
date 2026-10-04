// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { DeviceStatus, DeviceType, type Lap, RunStatus, RunTransitionAction } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useTimekeeperMqtt } from '#hooks/useTimekeeperMqtt.js';
import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';
import { useTimekeepingLaps, useTimekeepingRun, useTimekeepingSessionActions } from '#hooks/useTimekeepingSession.js';
import type { OverlayUpdateEvent } from '#pages/PhysicalRace/types/events.js';
import { useStartCarLogFetchMutation } from '#services/deepRacer/carLogsApi.js';
import { useListDevicesQuery } from '#services/deepRacer/devicesApi.js';
import { useGetEventQuery, useListEventTracksQuery } from '#services/deepRacer/eventsApi.js';
import { useCreateLapMutation, useSetLapValidityMutation } from '#services/deepRacer/lapsApi.js';
import { useTransitionRunStatusMutation } from '#services/deepRacer/runsApi.js';
import { displayWarningNotification } from '#store/notifications/notificationsSlice.js';

import './RaceControls.css';
import { formatCountdown, formatLapTime } from '../utils';

const COUNTDOWN_PUBLISH_INTERVAL_MS = 2000;

const OVERLAY_RACE_STATUS_BY_RUN_STATUS: Record<RunStatus, OverlayUpdateEvent['raceStatus']> = {
  [RunStatus.READY]: 'READY_TO_START',
  [RunStatus.IN_PROGRESS]: 'RACE_IN_PROGRESS',
  [RunStatus.PAUSED]: 'RACE_PAUSED',
  [RunStatus.FINISHED]: 'RACE_FINISHED',
  [RunStatus.SUBMITTED]: 'RACE_SUBMITTED',
  [RunStatus.DISCARDED]: 'NO_RACER_SELECTED',
};

export const RaceControls = () => {
  const { t } = useTranslation('timekeeping');
  const dispatch = useAppDispatch();

  const { activeRun, runSetup } = useTimekeepingRun();
  const { laps = [] } = useTimekeepingLaps();
  const { addOptimisticLap, removeOptimisticLap, registerActiveRun } = useTimekeepingSessionActions();
  const { fetchCarLogsOnRunFinish, selectedEventId, selectedLeaderboardId } = useTimekeepingContext();
  const { publishLapCaptured, publishOverlayUpdate } = useTimekeeperMqtt(
    selectedEventId ?? '',
    selectedLeaderboardId ?? '',
    { enabled: Boolean(selectedEventId && selectedLeaderboardId) },
  );

  const [createLap, { isLoading: isCreatingLap }] = useCreateLapMutation();
  const [setLapValidity] = useSetLapValidityMutation();
  const [transitionRunStatus, { isLoading: isTransitioning }] = useTransitionRunStatusMutation();
  const [startCarLogFetch] = useStartCarLogFetchMutation();
  const { data: event } = useGetEventQuery({ eventId: selectedEventId ?? '' }, { skip: !selectedEventId });
  const { data: tracks = [] } = useListEventTracksQuery({ eventId: selectedEventId ?? '' }, { skip: !selectedEventId });

  const [isSubmittingDnf, setIsSubmittingDnf] = useState(false);
  const [isMarkingLapInvalid, setIsMarkingLapInvalid] = useState(false);
  const [recordLapError, setRecordLapError] = useState<string | undefined>(undefined);
  const [publishError, setPublishError] = useState<string | undefined>(undefined);
  const [selectedCar, setSelectedCar] = useState<SelectProps.Option | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [raceElapsedMs, setRaceElapsedMs] = useState(0);
  const [lapElapsedMs, setLapElapsedMs] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const raceStartedAtRef = useRef<number | undefined>(undefined);
  const lapStartedAtRef = useRef<number | undefined>(undefined);
  const pausedRaceElapsedMsRef = useRef(0);
  const pausedLapElapsedMsRef = useRef(0);
  const previousRunStatusRef = useRef<RunStatus | undefined>(undefined);

  const racerName = runSetup?.selectedRacer.label;
  const activeRunStatus = activeRun?.runStatus;
  const isReady = activeRunStatus === RunStatus.READY;
  const isPaused = activeRunStatus === RunStatus.PAUSED;
  const isInProgress = activeRunStatus === RunStatus.IN_PROGRESS;
  const canFinish = isInProgress || isPaused;
  const publishRaceState = useCallback(
    async (runStatus: RunStatus): Promise<void> => {
      if (!activeRun) return;

      let raceElapsedForPublish = pausedRaceElapsedMsRef.current;
      let currentLapTimeMilliseconds = pausedLapElapsedMsRef.current;
      if (runStatus === RunStatus.IN_PROGRESS) {
        const now = Date.now();
        if (raceStartedAtRef.current !== undefined) {
          raceElapsedForPublish += now - raceStartedAtRef.current;
        }
        if (lapStartedAtRef.current !== undefined) {
          currentLapTimeMilliseconds += now - lapStartedAtRef.current;
        }
      }
      const timeLeftMilliseconds =
        event?.maxTimeInMinutes === undefined
          ? 0
          : Math.max(0, event.maxTimeInMinutes * 60 * 1000 - raceElapsedForPublish);
      const published = await publishOverlayUpdate({
        racerName: racerName ?? activeRun.profileId,
        laps: laps.map((lap) => ({
          lapNumber: lap.lapNumber,
          lapTimeMilliseconds: lap.lapTimeMs,
          isValid: lap.isValid,
        })),
        timeLeftMilliseconds,
        currentLapTimeMilliseconds: Math.max(0, currentLapTimeMilliseconds),
        raceStatus: OVERLAY_RACE_STATUS_BY_RUN_STATUS[runStatus],
      });
      if (!published) throw new Error('Failed to publish overlay update');
    },
    [activeRun, event?.maxTimeInMinutes, laps, publishOverlayUpdate, racerName],
  );
  let runControlAction: RunTransitionAction | undefined;
  if (isReady) {
    runControlAction = RunTransitionAction.START;
  } else if (isInProgress) {
    runControlAction = RunTransitionAction.PAUSE;
  } else if (isPaused) {
    runControlAction = RunTransitionAction.RESUME;
  }

  const resetRaceTimers = useCallback(() => {
    setRaceElapsedMs(0);
    setLapElapsedMs(0);
    setIsTimerRunning(false);
    raceStartedAtRef.current = undefined;
    lapStartedAtRef.current = undefined;
    pausedRaceElapsedMsRef.current = 0;
    pausedLapElapsedMsRef.current = 0;
  }, []);
  const selectedTrack = useMemo(
    () => tracks.find((track) => track.leaderboardId === selectedLeaderboardId),
    [selectedLeaderboardId, tracks],
  );

  useEffect(() => {
    setSelectedCar(null);
  }, [selectedLeaderboardId]);

  useEffect(() => {
    setResetCount(0);
    resetRaceTimers();
  }, [activeRun?.runId, resetRaceTimers]);

  const { data: devices = [], isLoading: isLoadingDevices } = useListDevicesQuery(
    {
      deviceType: DeviceType.CAR,
      status: DeviceStatus.ONLINE,
      fleetId: selectedTrack?.fleetId,
    },
    { skip: !selectedLeaderboardId },
  );
  const carOptions: SelectProps.Options = useMemo(
    () => devices.map((device) => ({ label: device.name, value: device.instanceId })),
    [devices],
  );
  const handleCarChange = useCallback<NonNullable<SelectProps['onChange']>>(({ detail }) => {
    setSelectedCar(detail.selectedOption);
  }, []);
  const handleCarReset = useCallback(() => {
    if (!isInProgress) return;

    setResetCount((currentCount) => currentCount + 1);
  }, [isInProgress]);
  const handleResetCountReset = useCallback(() => {
    if (!isInProgress) return;

    setResetCount(0);
  }, [isInProgress]);
  const startRaceTimer = useCallback(() => {
    const startedAt = Date.now();
    raceStartedAtRef.current = startedAt;
    lapStartedAtRef.current = startedAt;
    pausedRaceElapsedMsRef.current = 0;
    pausedLapElapsedMsRef.current = 0;
    setRaceElapsedMs(0);
    setLapElapsedMs(0);
    setIsTimerRunning(true);
  }, []);
  const pauseRaceTimer = useCallback(() => {
    const now = Date.now();
    setIsTimerRunning(false);
    if (raceStartedAtRef.current !== undefined) {
      pausedRaceElapsedMsRef.current += now - raceStartedAtRef.current;
      setRaceElapsedMs(pausedRaceElapsedMsRef.current);
      raceStartedAtRef.current = undefined;
    }
    if (lapStartedAtRef.current !== undefined) {
      pausedLapElapsedMsRef.current += now - lapStartedAtRef.current;
      setLapElapsedMs(pausedLapElapsedMsRef.current);
      lapStartedAtRef.current = undefined;
    }
  }, []);
  const resumeRaceTimer = useCallback(() => {
    const resumedAt = Date.now();
    raceStartedAtRef.current = resumedAt;
    lapStartedAtRef.current = resumedAt;
    setIsTimerRunning(true);
  }, []);
  // RunsTable owns the "Resume run" action for a FINISHED run (RESUME_FROM_FINISHED), so this
  // effect is how RaceControls learns the run left FINISHED and restarts the local race/lap
  // timers from wherever handleFinish's pauseRaceTimer() froze them — the same frozen-ref state
  // a plain RESUME (PAUSED → IN_PROGRESS) already resumes from via resumeRaceTimer().
  useEffect(() => {
    const previousRunStatus = previousRunStatusRef.current;
    previousRunStatusRef.current = activeRunStatus;
    if (previousRunStatus === RunStatus.FINISHED && activeRunStatus === RunStatus.IN_PROGRESS) {
      resumeRaceTimer();
    }
  }, [activeRunStatus, resumeRaceTimer]);
  useEffect(() => {
    if (!isTimerRunning || raceStartedAtRef.current === undefined) return undefined;

    const intervalId = globalThis.setInterval(() => {
      const now = Date.now();
      const raceStartedAt = raceStartedAtRef.current;
      if (raceStartedAt !== undefined) {
        setRaceElapsedMs(pausedRaceElapsedMsRef.current + now - raceStartedAt);
      }
      const lapStartedAt = lapStartedAtRef.current;
      if (lapStartedAt !== undefined) {
        setLapElapsedMs(pausedLapElapsedMsRef.current + now - lapStartedAt);
      }
    }, 100);

    return () => globalThis.clearInterval(intervalId);
  }, [isTimerRunning]);
  useEffect(() => {
    if (activeRunStatus !== RunStatus.IN_PROGRESS && activeRunStatus !== RunStatus.PAUSED) return undefined;

    const publish = () => {
      publishRaceState(activeRunStatus)
        .then(() => setPublishError(undefined))
        .catch(() => setPublishError(t('errors.countdown')));
    };
    publish();
    const intervalId = globalThis.setInterval(publish, COUNTDOWN_PUBLISH_INTERVAL_MS);
    return () => globalThis.clearInterval(intervalId);
  }, [activeRunStatus, publishRaceState, t]);

  const handleRecordLap = useCallback(async () => {
    if (
      !activeRun ||
      !isInProgress ||
      !isTimerRunning ||
      !selectedEventId ||
      !selectedLeaderboardId ||
      lapStartedAtRef.current === undefined
    ) {
      return;
    }

    const crossingAt = Date.now();
    const previousLapStartedAt = lapStartedAtRef.current;
    const previousPausedLapElapsedMs = pausedLapElapsedMsRef.current;
    const previousResetCount = resetCount;
    const lapTimeMs = Math.max(1, previousPausedLapElapsedMs + crossingAt - previousLapStartedAt);
    const optimisticLap: Lap = {
      runId: activeRun.runId,
      leaderboardId: selectedLeaderboardId,
      lapNumber: laps.length + 1,
      lapTimeMs,
      isValid: true,
      resets: previousResetCount,
      createdAt: new Date(crossingAt),
      updatedAt: new Date(crossingAt),
      ...(selectedCar?.value === undefined ? {} : { deviceId: selectedCar.value }),
    };

    setRecordLapError(undefined);
    addOptimisticLap(optimisticLap);
    lapStartedAtRef.current = crossingAt;
    pausedLapElapsedMsRef.current = 0;
    setLapElapsedMs(0);
    setResetCount(0);

    try {
      await createLap({
        eventId: selectedEventId,
        leaderboardId: selectedLeaderboardId,
        runId: activeRun.runId,
        deviceId: selectedCar?.value,
        lapTimeMs,
        resets: previousResetCount,
        clientToken: crypto.randomUUID(),
      }).unwrap();
      void publishLapCaptured({
        lapNumber: optimisticLap.lapNumber,
        lapTimeMilliseconds: lapTimeMs,
        isValid: true,
        resets: previousResetCount,
      }).catch(() => undefined);
    } catch {
      removeOptimisticLap(optimisticLap);
      lapStartedAtRef.current = previousLapStartedAt;
      pausedLapElapsedMsRef.current = previousPausedLapElapsedMs;
      setLapElapsedMs(previousPausedLapElapsedMs + Date.now() - previousLapStartedAt);
      setResetCount(previousResetCount);
      setRecordLapError(t('manualTiming.lapError'));
    }
  }, [
    activeRun,
    addOptimisticLap,
    createLap,
    isInProgress,
    isTimerRunning,
    laps.length,
    removeOptimisticLap,
    publishLapCaptured,
    resetCount,
    selectedCar?.value,
    selectedEventId,
    selectedLeaderboardId,
    t,
  ]);
  const submitInvalidLap = useCallback(
    async ({
      errorMessage,
      onPaused,
      onRollback,
      setIsSubmitting,
    }: {
      errorMessage: string;
      onPaused: (crossingAt: number, lapTimeMs: number) => void;
      onRollback: (previousRaceStartedAt: number | undefined, previousPausedRaceElapsedMs: number) => void;
      setIsSubmitting: (isSubmitting: boolean) => void;
    }) => {
      if (
        !activeRun ||
        !isInProgress ||
        !isTimerRunning ||
        !selectedEventId ||
        !selectedLeaderboardId ||
        lapStartedAtRef.current === undefined
      ) {
        return;
      }

      const crossingAt = Date.now();
      const previousLapStartedAt = lapStartedAtRef.current;
      const previousPausedLapElapsedMs = pausedLapElapsedMsRef.current;
      const previousRaceStartedAt = raceStartedAtRef.current;
      const previousPausedRaceElapsedMs = pausedRaceElapsedMsRef.current;
      const previousResetCount = resetCount;
      const lapTimeMs = Math.max(1, previousPausedLapElapsedMs + crossingAt - previousLapStartedAt);
      const optimisticLap: Lap = {
        runId: activeRun.runId,
        leaderboardId: selectedLeaderboardId,
        lapNumber: laps.length + 1,
        lapTimeMs,
        isValid: false,
        resets: previousResetCount,
        createdAt: new Date(crossingAt),
        updatedAt: new Date(crossingAt),
        ...(selectedCar?.value === undefined ? {} : { deviceId: selectedCar.value }),
      };

      setRecordLapError(undefined);
      setIsSubmitting(true);
      addOptimisticLap(optimisticLap);
      lapStartedAtRef.current = crossingAt;
      pausedLapElapsedMsRef.current = 0;
      setLapElapsedMs(0);
      setResetCount(0);
      // Freeze the race/lap clocks optimistically, in lockstep with the rest of this function's
      // optimistic state — the timekeeper expects the display to stop the instant they click,
      // not after the CreateLap/SetLapValidity/PAUSE round-trip resolves.
      onPaused(crossingAt, lapTimeMs);

      let isLapPersisted = false;
      try {
        const lap = await createLap({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId: activeRun.runId,
          deviceId: selectedCar?.value,
          lapTimeMs,
          resets: previousResetCount,
          clientToken: crypto.randomUUID(),
        }).unwrap();
        isLapPersisted = true;
        await setLapValidity({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId: activeRun.runId,
          lapNumber: lap.lapNumber,
          isValid: false,
        }).unwrap();
        void publishLapCaptured({
          lapNumber: lap.lapNumber,
          lapTimeMilliseconds: lapTimeMs,
          isValid: false,
          resets: previousResetCount,
        }).catch(() => undefined);
        const { run } = await transitionRunStatus({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId: activeRun.runId,
          action: RunTransitionAction.PAUSE,
        }).unwrap();
        registerActiveRun(run);
      } catch {
        if (!isLapPersisted) {
          removeOptimisticLap(optimisticLap);
          lapStartedAtRef.current = previousLapStartedAt;
          pausedLapElapsedMsRef.current = previousPausedLapElapsedMs;
          setLapElapsedMs(previousPausedLapElapsedMs + Date.now() - previousLapStartedAt);
          setResetCount(previousResetCount);
          onRollback(previousRaceStartedAt, previousPausedRaceElapsedMs);
        }
        setRecordLapError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeRun,
      addOptimisticLap,
      createLap,
      isInProgress,
      isTimerRunning,
      laps.length,
      registerActiveRun,
      removeOptimisticLap,
      publishLapCaptured,
      resetCount,
      selectedCar?.value,
      selectedEventId,
      selectedLeaderboardId,
      setLapValidity,
      transitionRunStatus,
    ],
  );
  const pauseInvalidatedLapTimer = useCallback((crossingAt: number, lapTimeMs: number) => {
    const raceStartedAt = raceStartedAtRef.current;
    const raceElapsedAtCrossing =
      raceStartedAt === undefined
        ? pausedRaceElapsedMsRef.current
        : pausedRaceElapsedMsRef.current + crossingAt - raceStartedAt;
    const restoredRaceElapsedMs = Math.max(0, raceElapsedAtCrossing - lapTimeMs);

    pausedRaceElapsedMsRef.current = restoredRaceElapsedMs;
    pausedLapElapsedMsRef.current = 0;
    raceStartedAtRef.current = undefined;
    lapStartedAtRef.current = undefined;
    setRaceElapsedMs(restoredRaceElapsedMs);
    setLapElapsedMs(0);
    setIsTimerRunning(false);
  }, []);
  // Inverse of the optimistic pause (pauseRaceTimer/pauseInvalidatedLapTimer) for when CreateLap
  // itself fails — the lap-side fields (lapStartedAtRef/pausedLapElapsedMsRef/resetCount) are
  // already restored generically in submitInvalidLap's catch block; this restores the race-clock
  // fields, which differ per pause variant (DNF never touches pausedRaceElapsedMsRef; Mark Lap
  // Invalid subtracts from it), and resumes ticking.
  const rollbackPause = useCallback(
    (previousRaceStartedAt: number | undefined, previousPausedRaceElapsedMs: number) => {
      pausedRaceElapsedMsRef.current = previousPausedRaceElapsedMs;
      raceStartedAtRef.current = previousRaceStartedAt ?? Date.now();
      setRaceElapsedMs(
        previousPausedRaceElapsedMs + (previousRaceStartedAt === undefined ? 0 : Date.now() - previousRaceStartedAt),
      );
      setIsTimerRunning(true);
    },
    [],
  );
  const handleDidNotFinish = useCallback(
    async () =>
      submitInvalidLap({
        errorMessage: t('manualTiming.didNotFinishError'),
        onPaused: () => pauseRaceTimer(),
        onRollback: rollbackPause,
        setIsSubmitting: setIsSubmittingDnf,
      }),
    [pauseRaceTimer, rollbackPause, submitInvalidLap, t],
  );
  const handleMarkLapInvalid = useCallback(
    async () =>
      submitInvalidLap({
        errorMessage: t('manualTiming.markLapInvalidError'),
        onPaused: pauseInvalidatedLapTimer,
        onRollback: rollbackPause,
        setIsSubmitting: setIsMarkingLapInvalid,
      }),
    [pauseInvalidatedLapTimer, rollbackPause, submitInvalidLap, t],
  );
  const autoFetchCarLogsForRun = useCallback(
    async (runId: string, createdAt: Date, deviceIds: Array<string | undefined>) => {
      if (!fetchCarLogsOnRunFinish || !selectedEventId || !selectedLeaderboardId) return;

      const uniqueDeviceIds = [...new Set(deviceIds.filter((deviceId): deviceId is string => Boolean(deviceId)))];
      if (uniqueDeviceIds.length === 0) {
        dispatch(displayWarningNotification({ content: t('warnings.carLogFetchMissingDevice') }));
        return;
      }

      const results = await Promise.all(
        uniqueDeviceIds.map(async (instanceId) => {
          try {
            await startCarLogFetch({
              leaderboardId: selectedLeaderboardId,
              runId,
              instanceId,
              laterThan: createdAt,
              ...(racerName ? { racerName } : {}),
            }).unwrap();
            return true;
          } catch {
            return false;
          }
        }),
      );

      if (results.some((result) => !result)) {
        dispatch(displayWarningNotification({ content: t('warnings.carLogFetchFailed') }));
      }
    },
    [dispatch, fetchCarLogsOnRunFinish, racerName, selectedEventId, selectedLeaderboardId, startCarLogFetch, t],
  );
  const handleFinish = useCallback(async () => {
    if (!activeRun || !canFinish || !selectedEventId || !selectedLeaderboardId) return;

    try {
      const { run } = await transitionRunStatus({
        eventId: selectedEventId,
        leaderboardId: selectedLeaderboardId,
        runId: activeRun.runId,
        action: RunTransitionAction.FINISH,
      }).unwrap();
      pauseRaceTimer();
      registerActiveRun(run);
      void autoFetchCarLogsForRun(run.runId, run.createdAt, [selectedCar?.value, ...laps.map((lap) => lap.deviceId)]);
      try {
        await publishRaceState(RunStatus.FINISHED);
        setPublishError(undefined);
      } catch {
        setPublishError(t('errors.countdown'));
      }
    } catch {
      // Leave the local timers running when the FINISH transition is rejected.
    }
  }, [
    activeRun,
    canFinish,
    autoFetchCarLogsForRun,
    pauseRaceTimer,
    publishRaceState,
    registerActiveRun,
    laps,
    selectedCar?.value,
    selectedEventId,
    selectedLeaderboardId,
    t,
    transitionRunStatus,
  ]);
  const handleRunControl = useCallback(async () => {
    if (!activeRun || !runControlAction || !selectedEventId || !selectedLeaderboardId) return;

    const isStarting = runControlAction === RunTransitionAction.START;
    const isPausing = runControlAction === RunTransitionAction.PAUSE;
    const isResuming = runControlAction === RunTransitionAction.RESUME;
    if (isStarting) {
      startRaceTimer();
    } else if (isPausing) {
      pauseRaceTimer();
    } else if (isResuming) {
      resumeRaceTimer();
    }

    try {
      const { run } = await transitionRunStatus({
        eventId: selectedEventId,
        leaderboardId: selectedLeaderboardId,
        runId: activeRun.runId,
        action: runControlAction,
      }).unwrap();
      registerActiveRun(run);
    } catch {
      if (isStarting) {
        resetRaceTimers();
      } else if (isPausing) {
        resumeRaceTimer();
      } else if (isResuming) {
        pauseRaceTimer();
      }
    }
  }, [
    activeRun,
    pauseRaceTimer,
    registerActiveRun,
    resetRaceTimers,
    resumeRaceTimer,
    runControlAction,
    selectedEventId,
    selectedLeaderboardId,
    startRaceTimer,
    transitionRunStatus,
  ]);

  const remainingMs =
    event?.maxTimeInMinutes === undefined ? undefined : Math.max(0, event.maxTimeInMinutes * 60 * 1000 - raceElapsedMs);

  return (
    <Container data-id="RaceControls" data-testid="race-controls" variant="stacked">
      <SpaceBetween size="s">
        <ColumnLayout columns={2} minColumnWidth={100}>
          <SpaceBetween size="xxxs">
            <Box variant="awsui-key-label">{t('racerSelector.header')}</Box>
            <Box data-testid="racer-name" variant="h4">
              {racerName ?? t('racerSelector.placeholder')}
            </Box>
            <Box variant="awsui-key-label">{t('manualTiming.countdownLabel')}</Box>
            <Box data-testid="time-left" variant="h4">
              {formatCountdown(remainingMs)}
            </Box>
          </SpaceBetween>
          <SpaceBetween size="xxxs">
            <Box variant="awsui-key-label">{t('carSelector.label')}</Box>
            <Select
              selectedOption={selectedCar}
              onChange={handleCarChange}
              options={carOptions}
              placeholder={t('carSelector.placeholder')}
              loadingText={t('carSelector.loadingText')}
              statusType={isLoadingDevices ? 'loading' : 'finished'}
              disabled={(!isReady && !isPaused) || !selectedLeaderboardId || isLoadingDevices}
              filteringType="auto"
              data-testid="car-select"
            />
            <Box variant="awsui-key-label">{t('manualTiming.lapElapsedLabel')}</Box>
            <Box data-testid="current-lap" variant="h3">
              {formatLapTime(lapElapsedMs)}
            </Box>
          </SpaceBetween>
        </ColumnLayout>
        <Button
          data-button-size="large"
          disabled={!isInProgress || !isTimerRunning || isCreatingLap || isSubmittingDnf || isMarkingLapInvalid}
          fullWidth
          loading={isCreatingLap}
          onClick={() => handleRecordLap()}
        >
          {t('manualTiming.recordLap')}
        </Button>
        {recordLapError && (
          <Alert dismissible type="error" onDismiss={() => setRecordLapError(undefined)}>
            {recordLapError}
          </Alert>
        )}
        {publishError && (
          <Alert dismissible type="error" onDismiss={() => setPublishError(undefined)}>
            {publishError}
          </Alert>
        )}
        <ColumnLayout columns={2}>
          <Button
            data-button-size="large"
            disabled={!isInProgress || !isTimerRunning || isCreatingLap || isSubmittingDnf || isMarkingLapInvalid}
            fullWidth
            loading={isSubmittingDnf}
            onClick={() => handleDidNotFinish()}
          >
            {t('manualTiming.didNotFinish')}
          </Button>
          <Button
            data-button-size="large"
            disabled={!isInProgress || !isTimerRunning || isCreatingLap || isSubmittingDnf || isMarkingLapInvalid}
            fullWidth
            loading={isMarkingLapInvalid}
            onClick={() => handleMarkLapInvalid()}
          >
            {t('manualTiming.markLapInvalid')}
          </Button>
        </ColumnLayout>
        <ColumnLayout columns={2} minColumnWidth={2}>
          <SpaceBetween data-testid="reset-info-and-decrement" direction="horizontal" size="s">
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">{t('manualTiming.resetsLabel')}</Box>
              <Box data-testid="reset-count" variant="h3">
                {resetCount}/{t('manualTiming.unlimitedResets')}
              </Box>
            </SpaceBetween>
            <Button
              data-button-size="large"
              disabled={!isInProgress || resetCount === 0}
              onClick={handleResetCountReset}
            >
              -1
            </Button>
          </SpaceBetween>
          <Button data-button-size="large" disabled={!isInProgress} fullWidth onClick={handleCarReset}>
            {t('manualTiming.carReset')}
          </Button>
        </ColumnLayout>
        <ColumnLayout columns={2} minColumnWidth={1}>
          <Button
            data-button-size="large"
            disabled={!canFinish || isTransitioning}
            fullWidth
            loading={isTransitioning}
            onClick={() => handleFinish()}
          >
            {t('actions.FINISH')}
          </Button>
          <Button
            data-button-size="large"
            data-button-color="orange"
            disabled={!runControlAction || isTransitioning}
            fullWidth
            loading={isTransitioning}
            onClick={() => handleRunControl()}
            variant="primary"
          >
            {t(`actions.${runControlAction ?? RunTransitionAction.START}`)}
          </Button>
        </ColumnLayout>
      </SpaceBetween>
    </Container>
  );
};
