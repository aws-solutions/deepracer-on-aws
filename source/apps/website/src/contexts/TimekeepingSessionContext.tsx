// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Lap, Run, RunStatus } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocalStorage } from '#hooks/useLocalStorage.js';
import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';
import { useGetRunQuery } from '#services/deepRacer/runsApi.js';

import {
  TimekeepingLapsContext,
  TimekeepingRunContext,
  TimekeepingSessionActionsContext,
  type TimekeepingLapsValue,
  type TimekeepingRunSetup,
  type TimekeepingRunValue,
  type TimekeepingSessionActionsValue,
} from './timekeepingSessionContextValue';

interface PersistedTimingRecovery {
  raceStartedAtMs?: number;
  lapStartedAtMs?: number;
  pausedRaceElapsedMs: number;
  pausedLapElapsedMs: number;
  pendingResetCount: number;
}

interface PersistedTimekeepingSession {
  version: number;
  eventId: string;
  leaderboardId: string;
  runId: string;
  profileId: string;
  racerName: string;
  racedByProxy: boolean;
  runStatus: RunStatus;
  timing: PersistedTimingRecovery;
}

const STORAGE_KEY = 'deepracer-timekeeping-active-session';
const SESSION_VERSION = 1;

const DEFAULT_TIMING_RECOVERY: PersistedTimingRecovery = {
  pausedRaceElapsedMs: 0,
  pausedLapElapsedMs: 0,
  pendingResetCount: 0,
};

const isDiscardedOrSubmitted = (status: RunStatus): boolean =>
  status === RunStatus.DISCARDED || status === RunStatus.SUBMITTED;

const toPersistedSession = (
  eventId: string,
  leaderboardId: string,
  run: Run,
  setup: TimekeepingRunSetup,
): PersistedTimekeepingSession => ({
  version: SESSION_VERSION,
  eventId,
  leaderboardId,
  runId: run.runId,
  profileId: run.profileId,
  racerName: setup.selectedRacer.label ?? run.profileId,
  racedByProxy: setup.racedByProxy,
  runStatus: run.runStatus,
  timing: DEFAULT_TIMING_RECOVERY,
});

export const TimekeepingSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { selectedEventId, selectedLeaderboardId } = useTimekeepingContext();
  const [persistedSession, setPersistedSession] = useLocalStorage<PersistedTimekeepingSession | null>(
    STORAGE_KEY,
    null,
  );
  const [activeRun, setActiveRun] = useState<Run | undefined>(undefined);
  const [optimisticLaps, setOptimisticLaps] = useState<Lap[]>([]);
  const [runSetup, setRunSetup] = useState<TimekeepingRunSetup | undefined>(undefined);

  const activeRunRef = useRef(activeRun);
  const runSetupRef = useRef(runSetup);
  const selectedEventIdRef = useRef(selectedEventId);
  const selectedLeaderboardIdRef = useRef(selectedLeaderboardId);
  activeRunRef.current = activeRun;
  runSetupRef.current = runSetup;
  selectedEventIdRef.current = selectedEventId;
  selectedLeaderboardIdRef.current = selectedLeaderboardId;

  const sessionMatchesSelection = Boolean(
    persistedSession &&
    selectedEventId === persistedSession.eventId &&
    selectedLeaderboardId === persistedSession.leaderboardId,
  );
  const { data: runData, isFetching: isHydrating } = useGetRunQuery(
    {
      eventId: persistedSession?.eventId ?? '',
      leaderboardId: persistedSession?.leaderboardId ?? '',
      runId: persistedSession?.runId ?? '',
    },
    { skip: !sessionMatchesSelection },
  );
  const serverLaps = useMemo(
    () => (activeRun && runData?.run?.runId === activeRun.runId ? runData.laps : []),
    [activeRun, runData],
  );
  const laps = useMemo(
    () => [
      ...serverLaps,
      ...optimisticLaps.filter(
        (optimisticLap) =>
          !serverLaps.some(
            (serverLap) =>
              serverLap.lapNumber === optimisticLap.lapNumber && serverLap.lapTimeMs === optimisticLap.lapTimeMs,
          ),
      ),
    ],
    [optimisticLaps, serverLaps],
  );

  const clearSession = useCallback(() => {
    setPersistedSession(null);
    setActiveRun(undefined);
    setOptimisticLaps([]);
    setRunSetup(undefined);
  }, [setPersistedSession]);

  const addOptimisticLap = useCallback((lap: Lap) => {
    setOptimisticLaps((currentLaps) => [...currentLaps, lap]);
  }, []);

  const removeOptimisticLap = useCallback((lap: Lap) => {
    setOptimisticLaps((currentLaps) => currentLaps.filter((candidateLap) => candidateLap !== lap));
  }, []);

  const registerActiveRun = useCallback(
    (run: Run | undefined, setup?: TimekeepingRunSetup) => {
      const eventId = selectedEventIdRef.current;
      const leaderboardId = selectedLeaderboardIdRef.current;
      if (!run || !eventId || !leaderboardId || isDiscardedOrSubmitted(run.runStatus)) {
        clearSession();
        return;
      }

      const currentRun = activeRunRef.current;
      const currentSetup = runSetupRef.current;
      const resolvedSetup = setup ?? currentSetup;
      const isSameRun = currentRun?.runId === run.runId && currentRun.runStatus === run.runStatus;
      const isSameSetup =
        resolvedSetup?.selectedRacer.value === currentSetup?.selectedRacer.value &&
        resolvedSetup?.racedByProxy === currentSetup?.racedByProxy;
      if (isSameRun && isSameSetup) return;

      if (currentRun?.runId !== run.runId) setOptimisticLaps([]);

      setActiveRun(run);
      if (!resolvedSetup) return;

      setRunSetup(resolvedSetup);
      setPersistedSession(toPersistedSession(eventId, leaderboardId, run, resolvedSetup));
    },
    [clearSession, setPersistedSession],
  );

  const registerCreatedRun = useCallback(
    (run: Run, setup: TimekeepingRunSetup) => registerActiveRun(run, setup),
    [registerActiveRun],
  );

  useEffect(() => {
    if (!persistedSession) return;
    if (!sessionMatchesSelection) {
      clearSession();
      return;
    }
    if (!runData?.run) return;

    const { run } = runData;
    if (run.runId !== persistedSession.runId) return;

    if (isDiscardedOrSubmitted(run.runStatus)) {
      clearSession();
      return;
    }

    // Server state establishes the session only during initial hydration.
    if (activeRunRef.current) return;

    const setup: TimekeepingRunSetup = {
      selectedRacer: {
        label: persistedSession.racerName,
        value: persistedSession.profileId,
      },
      racedByProxy: persistedSession.racedByProxy,
    };
    setActiveRun(run);
    setRunSetup(setup);
  }, [clearSession, persistedSession, runData, sessionMatchesSelection]);

  const actionsValue = useMemo<TimekeepingSessionActionsValue>(
    () => ({
      registerActiveRun,
      registerCreatedRun,
      addOptimisticLap,
      removeOptimisticLap,
      clearSession,
    }),
    [addOptimisticLap, clearSession, registerActiveRun, registerCreatedRun, removeOptimisticLap],
  );
  const runValue = useMemo<TimekeepingRunValue>(() => ({ activeRun, runSetup }), [activeRun, runSetup]);
  const lapsValue = useMemo<TimekeepingLapsValue>(() => ({ laps, isHydrating }), [isHydrating, laps]);

  return (
    <TimekeepingSessionActionsContext.Provider value={actionsValue}>
      <TimekeepingRunContext.Provider value={runValue}>
        <TimekeepingLapsContext.Provider value={lapsValue}>{children}</TimekeepingLapsContext.Provider>
      </TimekeepingRunContext.Provider>
    </TimekeepingSessionActionsContext.Provider>
  );
};
