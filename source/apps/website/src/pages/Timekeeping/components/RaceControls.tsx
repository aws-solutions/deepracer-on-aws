// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import { isLapReviewRequired, RUN_NOT_IN_PROGRESS_MESSAGE } from '@deepracer-indy/config';
import {
  DeviceStatus,
  DeviceType,
  type Lap,
  LapReviewStatus,
  LapTimingSource,
  RunStatus,
  RunTransitionAction,
} from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTimekeeperMqtt } from '#hooks/useTimekeeperMqtt.js';
import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';
import { useTimekeepingLaps, useTimekeepingRun, useTimekeepingSessionActions } from '#hooks/useTimekeepingSession.js';
import { ConnectionStatus, type TimerMqttEvent, useTimerMqtt } from '#hooks/useTimerMqtt.js';
import type { OverlayUpdateEvent } from '#pages/PhysicalRace/types/events.js';
import { useListDevicesQuery } from '#services/deepRacer/devicesApi.js';
import { useGetEventQuery, useListEventTracksQuery } from '#services/deepRacer/eventsApi.js';
import { useCreateLapMutation, useSetLapValidityMutation } from '#services/deepRacer/lapsApi.js';
import { useLazyGetRunQuery, useTransitionRunStatusMutation } from '#services/deepRacer/runsApi.js';

import './RaceControls.css';
import { classifyCrossing, formatCountdown, formatLapTime, type SeenCrossing, type TimerLapEvent } from '../utils';

const COUNTDOWN_PUBLISH_INTERVAL_MS = 2000;
/** A timer heartbeats every 30s; after two missed heartbeats it is reported as not responding. */
const TIMER_STALE_AFTER_MS = 75_000;
const TIMER_STATUS_REFRESH_MS = 5000;
/**
 * A crossing published this long after it happened (publish retries after a network blip) is too
 * old to start or resume a run: the facilitator may have paused or set up the next run since.
 */
const STALE_CROSSING_MS = 2000;
/** Backoff for retrying a crossing lap's CreateLap after a network or server error. */
const CROSSING_LAP_RETRY_DELAYS_MS = [500, 1500];

const TimingMode = {
  MANUAL: 'MANUAL',
  AUTO: 'AUTO',
} as const;
type TimingMode = (typeof TimingMode)[keyof typeof TimingMode];

interface RecordLapOptions {
  timingSource: LapTimingSource;
  lapTimeMs?: number;
  crossingToken?: string;
  missedCrossings?: number;
}

const MANUAL_LAP_OPTIONS: RecordLapOptions = { timingSource: LapTimingSource.MANUAL };

/**
 * `failed` means a crossing lap couldn't be recorded even after retries (network or server error):
 * the caller rolls its crossing baseline back and flags the next lap.
 */
type RecordLapOutcome = 'recorded' | 'duplicate' | 'failed' | 'skipped';

/** The shape of a rejected RTK Query mutation from the DeepRacer API (see deepRacerApi.ts). */
interface ApiError {
  name?: string;
  error?: string;
  fault?: 'client' | 'server';
}

/** CreateLap's modelled client errors: retrying the same request can't change their outcome. */
const NON_RETRYABLE_API_ERRORS = new Set(['ConflictError', 'BadRequestError', 'NotAuthorizedError', 'NotFoundError']);

/** Network failures carry no fault; server faults are worth retrying, client faults are not. */
const isTransientApiError = (error: unknown): boolean => {
  const { name, fault } = (error ?? {}) as ApiError;
  return fault !== 'client' && !NON_RETRYABLE_API_ERRORS.has(name ?? '');
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const isLapNumberConflict = (error: unknown): boolean => {
  const { name, error: message } = (error ?? {}) as ApiError;
  return name === 'ConflictError' && message !== RUN_NOT_IN_PROGRESS_MESSAGE;
};

/** handleRunControl and handleRecordLap surface their own errors, so callers only detach them. */
const ignoreRejection = (): undefined => undefined;

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

  const { activeRun, runSetup } = useTimekeepingRun();
  const { laps = [] } = useTimekeepingLaps();
  const { addOptimisticLap, removeOptimisticLap, registerActiveRun } = useTimekeepingSessionActions();
  const { selectedEventId, selectedLeaderboardId } = useTimekeepingContext();
  const { publishLapCaptured, publishOverlayUpdate } = useTimekeeperMqtt(
    selectedEventId ?? '',
    selectedLeaderboardId ?? '',
    { enabled: Boolean(selectedEventId && selectedLeaderboardId) },
  );

  const [createLap, { isLoading: isCreatingLap }] = useCreateLapMutation();
  const [setLapValidity] = useSetLapValidityMutation();
  const [transitionRunStatus, { isLoading: isTransitioning }] = useTransitionRunStatusMutation();
  const [fetchRun] = useLazyGetRunQuery();
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
  const [timingMode, setTimingMode] = useState<TimingMode>(TimingMode.MANUAL);
  const [selectedTimer, setSelectedTimer] = useState<SelectProps.Option | null>(null);
  const [timerLastSeenAt, setTimerLastSeenAt] = useState<number | undefined>(undefined);
  const [statusNow, setStatusNow] = useState(() => Date.now());

  const raceStartedAtRef = useRef<number | undefined>(undefined);
  const lapStartedAtRef = useRef<number | undefined>(undefined);
  const pausedRaceElapsedMsRef = useRef(0);
  const pausedLapElapsedMsRef = useRef(0);
  const previousRunStatusRef = useRef<RunStatus | undefined>(undefined);
  const lastCrossingTimestampRef = useRef<number | undefined>(undefined);
  const lastSeenCrossingRef = useRef<SeenCrossing | undefined>(undefined);
  // Laps that ended with a crossing but couldn't be recorded; the next crossing lap spans them.
  const lostCrossingLapsRef = useRef(0);

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
    setSelectedTimer(null);
    setTimingMode(TimingMode.MANUAL);
  }, [selectedLeaderboardId]);

  useEffect(() => {
    if (activeRunStatus !== RunStatus.IN_PROGRESS) {
      lastCrossingTimestampRef.current = undefined;
      lostCrossingLapsRef.current = 0;
    }
  }, [activeRun?.runId, activeRunStatus]);

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
  const { data: timers = [], isLoading: isLoadingTimers } = useListDevicesQuery(
    { deviceType: DeviceType.TIMER, status: DeviceStatus.ONLINE },
    { skip: !selectedLeaderboardId },
  );
  const timerOptions: SelectProps.Options = useMemo(
    () => timers.map((timer) => ({ label: timer.name, value: timer.instanceId })),
    [timers],
  );
  const handleTimerChange = useCallback<NonNullable<SelectProps['onChange']>>(({ detail }) => {
    lastCrossingTimestampRef.current = undefined;
    lastSeenCrossingRef.current = undefined;
    lostCrossingLapsRef.current = 0;
    setTimerLastSeenAt(undefined);
    setSelectedTimer(detail.selectedOption);
  }, []);
  const handleTimingModeChange = useCallback((mode: string) => {
    // Switching mode doesn't end the lap: the lap clock still spans any lost crossing lap, so
    // lostCrossingLapsRef is kept and the next lap that ends is still flagged.
    lastCrossingTimestampRef.current = undefined;
    setTimingMode(mode === TimingMode.AUTO ? TimingMode.AUTO : TimingMode.MANUAL);
  }, []);
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

  // A crossing's time can't be measured again, so its CreateLap is retried with the same
  // idempotency token: once straight away after a lap-number conflict (a lost lap-count race
  // records it; a replayed token conflicts again, meaning the lap is already recorded), and with
  // backoff after network or server errors.
  const createCrossingLap = useCallback(async (send: () => Promise<unknown>) => {
    let conflictRetried = false;
    let transientRetries = 0;
    for (let attempt = 0; attempt <= 1 + CROSSING_LAP_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        await send();
        return;
      } catch (error) {
        if (isLapNumberConflict(error) && !conflictRetried) {
          conflictRetried = true;
        } else if (
          !isLapNumberConflict(error) &&
          isTransientApiError(error) &&
          transientRetries < CROSSING_LAP_RETRY_DELAYS_MS.length
        ) {
          await sleep(CROSSING_LAP_RETRY_DELAYS_MS[transientRetries]);
          transientRetries += 1;
        } else {
          throw error;
        }
      }
    }
  }, []);
  const handleRecordLap = useCallback(
    async ({
      timingSource,
      lapTimeMs: timerLapTimeMs,
      crossingToken,
      missedCrossings,
    }: RecordLapOptions = MANUAL_LAP_OPTIONS): Promise<RecordLapOutcome> => {
      if (
        !activeRun ||
        !isInProgress ||
        !isTimerRunning ||
        !selectedEventId ||
        !selectedLeaderboardId ||
        lapStartedAtRef.current === undefined
      ) {
        return 'skipped';
      }

      const crossingAt = Date.now();
      const previousLapStartedAt = lapStartedAtRef.current;
      const previousPausedLapElapsedMs = pausedLapElapsedMsRef.current;
      const previousResetCount = resetCount;
      const lapTimeMs = Math.max(1, timerLapTimeMs ?? previousPausedLapElapsedMs + crossingAt - previousLapStartedAt);
      const needsReview = isLapReviewRequired({ timingSource, lapTimeMs, missedCrossings });
      const optimisticLap: Lap = {
        runId: activeRun.runId,
        leaderboardId: selectedLeaderboardId,
        lapNumber: laps.length + 1,
        lapTimeMs,
        isValid: !needsReview,
        timingSource,
        reviewStatus: needsReview ? LapReviewStatus.PENDING_REVIEW : LapReviewStatus.NOT_REQUIRED,
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

      const lapInput = {
        eventId: selectedEventId,
        leaderboardId: selectedLeaderboardId,
        runId: activeRun.runId,
        deviceId: selectedCar?.value,
        lapTimeMs,
        resets: previousResetCount,
        timingSource,
        ...(missedCrossings !== undefined && { missedCrossings }),
        clientToken: crossingToken ?? crypto.randomUUID(),
      };
      try {
        if (crossingToken) await createCrossingLap(() => createLap(lapInput).unwrap());
        else await createLap(lapInput).unwrap();
        void publishLapCaptured({
          lapNumber: optimisticLap.lapNumber,
          lapTimeMilliseconds: lapTimeMs,
          isValid: !needsReview,
          resets: previousResetCount,
        }).catch(() => undefined);
      } catch (error) {
        removeOptimisticLap(optimisticLap);
        if (crossingToken && isLapNumberConflict(error)) {
          return 'duplicate';
        }
        lapStartedAtRef.current = previousLapStartedAt;
        pausedLapElapsedMsRef.current = previousPausedLapElapsedMs;
        setLapElapsedMs(previousPausedLapElapsedMs + Date.now() - previousLapStartedAt);
        setResetCount(previousResetCount);
        const runStopped = (error as ApiError | undefined)?.error === RUN_NOT_IN_PROGRESS_MESSAGE;
        setRecordLapError(
          crossingToken && runStopped ? t('autoTiming.crossingNotRecorded') : t('manualTiming.lapError'),
        );
        return runStopped ? 'skipped' : 'failed';
      }
      return 'recorded';
    },
    [
      activeRun,
      addOptimisticLap,
      createCrossingLap,
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
    ],
  );
  // A manual lap ends the timer-measured lap too, so the next crossing can't span both. If a
  // crossing lap was lost, this lap's clock covers it, so this lap carries the flag; if this lap
  // isn't recorded either, the count is kept for the retry, whose clock still covers it.
  const recordManualLap = useCallback(async () => {
    const missedCrossings = lostCrossingLapsRef.current;
    lastCrossingTimestampRef.current = undefined;
    lostCrossingLapsRef.current = 0;
    const outcome = await handleRecordLap({
      timingSource: LapTimingSource.MANUAL,
      ...(missedCrossings > 0 && { missedCrossings }),
    });
    if (outcome !== 'recorded') lostCrossingLapsRef.current += missedCrossings;
  }, [handleRecordLap]);
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
    pauseRaceTimer,
    publishRaceState,
    registerActiveRun,
    selectedEventId,
    selectedLeaderboardId,
    t,
    transitionRunStatus,
  ]);
  // Optimistically moves the local clocks for a run control action, before the API responds.
  const applyRunControlLocally = useCallback(
    (action: RunTransitionAction, fromCrossing: boolean) => {
      if (action === RunTransitionAction.START) {
        startRaceTimer();
      } else if (action === RunTransitionAction.PAUSE) {
        pauseRaceTimer();
      } else if (action === RunTransitionAction.RESUME) {
        if (fromCrossing) {
          pausedLapElapsedMsRef.current = 0;
          setLapElapsedMs(0);
        }
        resumeRaceTimer();
      }
    },
    [pauseRaceTimer, resumeRaceTimer, startRaceTimer],
  );
  // Undoes applyRunControlLocally when the transition is rejected.
  const rollBackRunControl = useCallback(
    (action: RunTransitionAction, fromCrossing: boolean, pausedLapBeforeResume: number) => {
      if (action === RunTransitionAction.START) {
        resetRaceTimers();
      } else if (action === RunTransitionAction.PAUSE) {
        resumeRaceTimer();
      } else if (action === RunTransitionAction.RESUME) {
        pauseRaceTimer();
        if (fromCrossing) {
          pausedLapElapsedMsRef.current = pausedLapBeforeResume;
          setLapElapsedMs(pausedLapBeforeResume);
        }
      }
    },
    [pauseRaceTimer, resetRaceTimers, resumeRaceTimer],
  );
  // With several pages in Automatic mode, every page sends START/RESUME for the same crossing and
  // the server accepts one. Returns true when the run is now in progress (another page won), after
  // adopting the server's run, so this page keeps timing instead of rolling back.
  const adoptRunIfInProgress = useCallback(
    async (runId: string): Promise<boolean> => {
      if (!selectedEventId || !selectedLeaderboardId) return false;
      try {
        const { run } = await fetchRun({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId,
        }).unwrap();
        if (run.runStatus !== RunStatus.IN_PROGRESS) return false;
        registerActiveRun(run);
        return true;
      } catch {
        return false;
      }
    },
    [fetchRun, registerActiveRun, selectedEventId, selectedLeaderboardId],
  );
  const handleRunControl = useCallback(
    async (options?: { fromCrossing?: boolean }) => {
      if (!activeRun || !runControlAction || !selectedEventId || !selectedLeaderboardId) return;

      const fromCrossing = options?.fromCrossing ?? false;
      // Kept so a failed crossing resume can put back the part-lap it cleared.
      const pausedLapBeforeResume = pausedLapElapsedMsRef.current;
      applyRunControlLocally(runControlAction, fromCrossing);

      try {
        const { run } = await transitionRunStatus({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId: activeRun.runId,
          action: runControlAction,
        }).unwrap();
        registerActiveRun(run);
      } catch {
        const mayHaveLostToAnotherPage = fromCrossing && runControlAction !== RunTransitionAction.PAUSE;
        if (mayHaveLostToAnotherPage && (await adoptRunIfInProgress(activeRun.runId))) return;
        rollBackRunControl(runControlAction, fromCrossing, pausedLapBeforeResume);
        if (fromCrossing) setRecordLapError(t('autoTiming.crossingTransitionFailed'));
      }
    },
    [
      activeRun,
      adoptRunIfInProgress,
      applyRunControlLocally,
      registerActiveRun,
      rollBackRunControl,
      runControlAction,
      selectedEventId,
      selectedLeaderboardId,
      t,
      transitionRunStatus,
    ],
  );

  // As in DREM, a crossing starts a ready run or resumes a paused one, unless it was published
  // too long after it happened to still mean "the car just crossed the line".
  const startOrResumeFromCrossing = useCallback(
    (timerEvent: TimerLapEvent) => {
      const ageMs = timerEvent.publishedAt === undefined ? 0 : timerEvent.publishedAt - timerEvent.timestamp;
      if (ageMs > STALE_CROSSING_MS) return;
      lastCrossingTimestampRef.current = timerEvent.timestamp;
      handleRunControl({ fromCrossing: true }).catch(ignoreRejection);
    },
    [handleRunControl],
  );
  // Ends the current lap at this crossing. With a previous crossing in this timer process, the lap
  // is timed on the timer's clock (AUTO); otherwise (timing started by a click, or the timer
  // restarted) on the browser clock from the lap's start (MANUAL). Lost crossings and laps that
  // couldn't be recorded are passed as missedCrossings, which flags the lap for review.
  const recordLapFromCrossing = useCallback(
    async (timerEvent: TimerLapEvent, crossing: ReturnType<typeof classifyCrossing>) => {
      const previousCrossingTimestamp = lastCrossingTimestampRef.current;
      lastCrossingTimestampRef.current = timerEvent.timestamp;
      const missedCrossings =
        crossing.missedCrossings + lostCrossingLapsRef.current + (crossing.timerRestarted ? 1 : 0);
      lostCrossingLapsRef.current = 0;
      const crossingToken = `${timerEvent.instanceId}:${timerEvent.bootId ?? ''}:${timerEvent.sequence}:${timerEvent.timestamp}`;
      const outcome = await handleRecordLap(
        previousCrossingTimestamp === undefined
          ? { timingSource: LapTimingSource.MANUAL, crossingToken, ...(missedCrossings > 0 && { missedCrossings }) }
          : {
              timingSource: LapTimingSource.AUTO,
              lapTimeMs: timerEvent.timestamp - previousCrossingTimestamp,
              crossingToken,
              missedCrossings,
            },
      );
      if (outcome !== 'failed') return;
      // The lap is lost: measure the next one from the previous crossing again, so it covers both
      // laps, and flag it.
      if (lastCrossingTimestampRef.current === timerEvent.timestamp) {
        lastCrossingTimestampRef.current = previousCrossingTimestamp;
      }
      lostCrossingLapsRef.current += missedCrossings + 1;
    },
    [handleRecordLap],
  );
  const handleTimerEvent = useCallback(
    (timerEvent: TimerMqttEvent) => {
      if (timerEvent.instanceId !== selectedTimer?.value) return;
      setTimerLastSeenAt(Date.now());
      if (timerEvent.eventType !== 'TIMER_LAP') return;

      const crossing = classifyCrossing(lastSeenCrossingRef.current, timerEvent);
      if (!crossing.isNew) return;
      lastSeenCrossingRef.current = { bootId: timerEvent.bootId, sequence: timerEvent.sequence };
      // Timestamps from before a restart are on a different clock (and may be ahead of it until
      // NTP syncs), so they can't be a baseline.
      if (crossing.timerRestarted) lastCrossingTimestampRef.current = undefined;
      if (timingMode !== TimingMode.AUTO) return;

      if (isReady || isPaused) {
        startOrResumeFromCrossing(timerEvent);
      } else if (isInProgress && isTimerRunning) {
        recordLapFromCrossing(timerEvent, crossing).catch(ignoreRejection);
      }
    },
    [
      isInProgress,
      isPaused,
      isReady,
      isTimerRunning,
      recordLapFromCrossing,
      selectedTimer?.value,
      startOrResumeFromCrossing,
      timingMode,
    ],
  );
  const { connectionStatus: timerConnectionStatus } = useTimerMqtt(String(selectedTimer?.value ?? ''), {
    onEvent: handleTimerEvent,
  });
  useEffect(() => {
    if (!selectedTimer) return undefined;

    const intervalId = globalThis.setInterval(() => setStatusNow(Date.now()), TIMER_STATUS_REFRESH_MS);
    return () => globalThis.clearInterval(intervalId);
  }, [selectedTimer]);

  let timerStatus: { type: StatusIndicatorProps.Type; text: string };
  if (!selectedTimer) {
    timerStatus = { type: 'stopped', text: t('autoTiming.status.noTimer') };
  } else if (timerConnectionStatus === ConnectionStatus.ERROR) {
    timerStatus = { type: 'error', text: t('autoTiming.status.connectionError') };
  } else if (timerConnectionStatus !== ConnectionStatus.CONNECTED) {
    timerStatus = { type: 'loading', text: t('autoTiming.status.connecting') };
  } else if (timerLastSeenAt === undefined || statusNow - timerLastSeenAt > TIMER_STALE_AFTER_MS) {
    timerStatus = { type: 'warning', text: t('autoTiming.status.notResponding') };
  } else {
    timerStatus = { type: 'success', text: t('autoTiming.status.online') };
  }

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
        <ColumnLayout columns={2} minColumnWidth={100}>
          <SpaceBetween size="xxxs">
            <Box variant="awsui-key-label">{t('autoTiming.modeLabel')}</Box>
            <SegmentedControl
              data-testid="timing-mode"
              label={t('autoTiming.modeLabel')}
              selectedId={timingMode}
              onChange={({ detail }) => handleTimingModeChange(detail.selectedId)}
              options={[
                { id: TimingMode.MANUAL, text: t('autoTiming.mode.MANUAL') },
                { id: TimingMode.AUTO, text: t('autoTiming.mode.AUTO'), disabled: !selectedTimer },
              ]}
            />
          </SpaceBetween>
          <SpaceBetween size="xxxs">
            <Box variant="awsui-key-label">{t('autoTiming.timerLabel')}</Box>
            <Select
              selectedOption={selectedTimer}
              onChange={handleTimerChange}
              options={timerOptions}
              placeholder={t('autoTiming.timerPlaceholder')}
              loadingText={t('autoTiming.timerLoadingText')}
              empty={t('autoTiming.noTimers')}
              statusType={isLoadingTimers ? 'loading' : 'finished'}
              disabled={!selectedLeaderboardId || isLoadingTimers || timingMode === TimingMode.AUTO}
              filteringType="auto"
              data-testid="timer-select"
            />
            <StatusIndicator data-testid="timer-status" type={timerStatus.type}>
              {timerStatus.text}
            </StatusIndicator>
          </SpaceBetween>
        </ColumnLayout>
        <Button
          data-button-size="large"
          disabled={!isInProgress || !isTimerRunning || isCreatingLap || isSubmittingDnf || isMarkingLapInvalid}
          fullWidth
          loading={isCreatingLap}
          onClick={() => {
            recordManualLap().catch(ignoreRejection);
          }}
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
            onClick={() => {
              lastCrossingTimestampRef.current = undefined;
              handleRunControl().catch(ignoreRejection);
            }}
            variant="primary"
          >
            {t(`actions.${runControlAction ?? RunTransitionAction.START}`)}
          </Button>
        </ColumnLayout>
      </SpaceBetween>
    </Container>
  );
};
