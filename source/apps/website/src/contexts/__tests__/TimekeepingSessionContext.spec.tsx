// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Lap, Run, RunStatus } from '@deepracer-indy/typescript-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimekeepingSessionProvider } from '#contexts/TimekeepingSessionContext.js';
import { useTimekeepingLaps, useTimekeepingRun, useTimekeepingSessionActions } from '#hooks/useTimekeepingSession.js';

const { mockUseTimekeepingContext, mockUseGetRunQuery } = vi.hoisted(() => ({
  mockUseTimekeepingContext: vi.fn(),
  mockUseGetRunQuery: vi.fn(),
}));

vi.mock('#hooks/useTimekeepingContext.js', () => ({
  useTimekeepingContext: mockUseTimekeepingContext,
}));

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useGetRunQuery: mockUseGetRunQuery,
}));

const run: Run = {
  runId: 'run-001',
  eventId: 'event-001',
  leaderboardId: 'leaderboard-001',
  profileId: 'profile-001',
  runStatus: RunStatus.READY,
  racedByProxy: true,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

const optimisticLap: Lap = {
  runId: run.runId,
  leaderboardId: run.leaderboardId,
  lapNumber: 1,
  lapTimeMs: 12000,
  isValid: true,
  resets: 0,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TimekeepingSessionProvider>{children}</TimekeepingSessionProvider>
);

const useTimekeepingSessionValues = () => ({
  ...useTimekeepingSessionActions(),
  ...useTimekeepingRun(),
  ...useTimekeepingLaps(),
});

describe('TimekeepingSessionProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUseTimekeepingContext.mockReturnValue({
      selectedEventId: 'event-001',
      selectedLeaderboardId: 'leaderboard-001',
    });
    mockUseGetRunQuery.mockReturnValue({ data: undefined, isFetching: false });
  });

  it('persists a created active run and its setup snapshot', async () => {
    const { result } = renderHook(() => useTimekeepingSessionValues(), { wrapper });

    act(() => {
      result.current.registerCreatedRun(run, {
        selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
        racedByProxy: true,
      });
    });

    expect(result.current.activeRun).toEqual(run);
    expect(result.current.runSetup).toEqual({
      selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
      racedByProxy: true,
    });
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('deepracer-timekeeping-active-session') ?? '')).toEqual(
        expect.objectContaining({
          version: 1,
          eventId: 'event-001',
          leaderboardId: 'leaderboard-001',
          runId: 'run-001',
          profileId: 'profile-001',
          racerName: 'SpeedRacer42',
          racedByProxy: true,
          runStatus: RunStatus.READY,
        }),
      );
    });
  });

  it('exposes optimistic laps immediately and removes them on rollback', () => {
    const { result } = renderHook(() => useTimekeepingSessionValues(), { wrapper });

    act(() => {
      result.current.addOptimisticLap(optimisticLap);
    });
    expect(result.current.laps).toEqual([optimisticLap]);

    act(() => {
      result.current.removeOptimisticLap(optimisticLap);
    });
    expect(result.current.laps).toEqual([]);
  });

  it('clears stale server laps when the active run changes', () => {
    const previousRun = { ...run, runId: 'run-previous' };
    const nextRun = { ...run, runId: 'run-next' };
    const previousLap = { ...optimisticLap, runId: previousRun.runId };
    const setup = {
      selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
      racedByProxy: true,
    };
    mockUseGetRunQuery.mockReturnValue({
      data: { run: previousRun, laps: [previousLap] },
      isFetching: true,
    });
    const { result } = renderHook(() => useTimekeepingSessionValues(), { wrapper });

    act(() => {
      result.current.registerCreatedRun(previousRun, setup);
    });
    expect(result.current.laps).toEqual([previousLap]);

    act(() => {
      result.current.registerCreatedRun(nextRun, setup);
    });

    expect(result.current.activeRun).toEqual(nextRun);
    expect(result.current.laps).toEqual([]);
  });

  it('isolates run and actions values from optimistic lap updates', () => {
    const { result } = renderHook(
      () => ({
        actions: useTimekeepingSessionActions(),
        laps: useTimekeepingLaps(),
        run: useTimekeepingRun(),
      }),
      { wrapper },
    );
    const initialActions = result.current.actions;
    const initialRun = result.current.run;

    act(() => {
      result.current.actions.addOptimisticLap(optimisticLap);
    });

    expect(result.current.laps.laps).toEqual([optimisticLap]);
    expect(result.current.actions).toBe(initialActions);
    expect(result.current.run).toBe(initialRun);
  });

  it('rehydrates the active run and setup from an authoritative GetRun response', async () => {
    localStorage.setItem(
      'deepracer-timekeeping-active-session',
      JSON.stringify({
        version: 1,
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-001',
        profileId: 'profile-001',
        racerName: 'SpeedRacer42',
        racedByProxy: true,
        runStatus: RunStatus.READY,
        timing: { pausedRaceElapsedMs: 0, pausedLapElapsedMs: 0, pendingResetCount: 0 },
      }),
    );
    mockUseGetRunQuery.mockReturnValue({ data: { run, laps: [] }, isFetching: false });

    const { result } = renderHook(() => useTimekeepingSessionValues(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeRun).toEqual(run);
    });
    expect(result.current.runSetup).toEqual({
      selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
      racedByProxy: true,
    });
  });

  it('does not replace an optimistic active run with a stale GetRun response', () => {
    const setup = {
      selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
      racedByProxy: true,
    };
    const inProgressRun = { ...run, runStatus: RunStatus.IN_PROGRESS };
    mockUseGetRunQuery.mockReturnValue({ data: undefined, isFetching: false });

    const { result, rerender } = renderHook(() => useTimekeepingSessionValues(), { wrapper });

    act(() => {
      result.current.registerCreatedRun(run, setup);
      result.current.registerActiveRun(inProgressRun);
    });
    expect(result.current.activeRun).toEqual(inProgressRun);

    mockUseGetRunQuery.mockReturnValue({ data: { run, laps: [] }, isFetching: false });
    rerender();

    expect(result.current.activeRun).toEqual(inProgressRun);
  });

  it('clears a persisted session when Event or Track selection changes', async () => {
    localStorage.setItem(
      'deepracer-timekeeping-active-session',
      JSON.stringify({
        version: 1,
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-001',
        profileId: 'profile-001',
        racerName: 'SpeedRacer42',
        racedByProxy: false,
        runStatus: RunStatus.READY,
        timing: { pausedRaceElapsedMs: 0, pausedLapElapsedMs: 0, pendingResetCount: 0 },
      }),
    );
    mockUseTimekeepingContext.mockReturnValue({
      selectedEventId: 'event-002',
      selectedLeaderboardId: 'leaderboard-002',
    });

    const { result } = renderHook(() => useTimekeepingSessionValues(), { wrapper });

    await waitFor(() => {
      expect(localStorage.getItem('deepracer-timekeeping-active-session')).toBe('null');
    });
    expect(result.current.activeRun).toBeUndefined();
  });
});
