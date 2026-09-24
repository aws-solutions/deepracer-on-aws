// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { createInitialRaceControlsState, RaceControlsActionType, raceControlsReducer } from '../raceControlsReducer';

describe('raceControlsReducer', () => {
  it('creates independent initial state objects', () => {
    const first = createInitialRaceControlsState();
    const second = createInitialRaceControlsState();

    expect(first).toEqual({
      selectedCar: null,
      resetCount: 0,
      raceElapsedMs: 0,
      lapElapsedMs: 0,
      isTimerRunning: false,
      recordLapError: undefined,
    });
    expect(first).not.toBe(second);
  });

  it('updates local timer state through start, tick, pause, and resume actions', () => {
    let state = createInitialRaceControlsState();

    state = raceControlsReducer(state, { type: RaceControlsActionType.START_TIMERS });
    state = raceControlsReducer(state, {
      type: RaceControlsActionType.TICK,
      raceElapsedMs: 1500,
      lapElapsedMs: 1500,
    });
    state = raceControlsReducer(state, {
      type: RaceControlsActionType.PAUSE_TIMERS,
      raceElapsedMs: 2000,
      lapElapsedMs: 2000,
    });
    state = raceControlsReducer(state, { type: RaceControlsActionType.RESUME_TIMERS });

    expect(state).toMatchObject({
      raceElapsedMs: 2000,
      lapElapsedMs: 2000,
      isTimerRunning: true,
    });
  });

  it('resets optimistic lap state and restores it after a rejected persistence request', () => {
    let state = { ...createInitialRaceControlsState(), resetCount: 2, lapElapsedMs: 4500 };

    state = raceControlsReducer(state, { type: RaceControlsActionType.RECORD_LAP_OPTIMISTIC });
    expect(state).toMatchObject({ resetCount: 0, lapElapsedMs: 0, recordLapError: undefined });

    state = raceControlsReducer(state, {
      type: RaceControlsActionType.RECORD_LAP_REJECTED,
      error: 'Could not record lap',
      resetCount: 2,
      lapElapsedMs: 4500,
    });

    expect(state).toMatchObject({
      resetCount: 2,
      lapElapsedMs: 4500,
      recordLapError: 'Could not record lap',
    });
  });

  it('preserves the selected car when resetting for a new run', () => {
    const selectedCar = { label: 'Car 1', value: 'car-001' };
    const state = {
      ...createInitialRaceControlsState(),
      selectedCar,
      resetCount: 1,
      raceElapsedMs: 5000,
      lapElapsedMs: 1000,
      isTimerRunning: true,
      recordLapError: 'Could not record lap',
    };

    expect(raceControlsReducer(state, { type: RaceControlsActionType.RESET_FOR_RUN })).toEqual({
      ...createInitialRaceControlsState(),
      selectedCar,
    });
  });
});
