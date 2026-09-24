// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SelectProps } from '@cloudscape-design/components/select';

export interface RaceControlsState {
  selectedCar: SelectProps.Option | null;
  resetCount: number;
  raceElapsedMs: number;
  lapElapsedMs: number;
  isTimerRunning: boolean;
  recordLapError: string | undefined;
}

export const RaceControlsActionType = {
  SELECT_CAR: 'SELECT_CAR',
  RESET_FOR_RUN: 'RESET_FOR_RUN',
  START_TIMERS: 'START_TIMERS',
  PAUSE_TIMERS: 'PAUSE_TIMERS',
  RESUME_TIMERS: 'RESUME_TIMERS',
  TICK: 'TICK',
  INCREMENT_RESET: 'INCREMENT_RESET',
  RECORD_LAP_OPTIMISTIC: 'RECORD_LAP_OPTIMISTIC',
  RECORD_LAP_REJECTED: 'RECORD_LAP_REJECTED',
  CLEAR_RECORD_LAP_ERROR: 'CLEAR_RECORD_LAP_ERROR',
} as const;

export type RaceControlsAction =
  | { type: typeof RaceControlsActionType.SELECT_CAR; selectedCar: SelectProps.Option | null }
  | { type: typeof RaceControlsActionType.RESET_FOR_RUN }
  | { type: typeof RaceControlsActionType.START_TIMERS }
  | { type: typeof RaceControlsActionType.PAUSE_TIMERS; raceElapsedMs: number; lapElapsedMs: number }
  | { type: typeof RaceControlsActionType.RESUME_TIMERS }
  | { type: typeof RaceControlsActionType.TICK; raceElapsedMs: number; lapElapsedMs: number }
  | { type: typeof RaceControlsActionType.INCREMENT_RESET }
  | { type: typeof RaceControlsActionType.RECORD_LAP_OPTIMISTIC }
  | { type: typeof RaceControlsActionType.RECORD_LAP_REJECTED; error: string; resetCount: number; lapElapsedMs: number }
  | { type: typeof RaceControlsActionType.CLEAR_RECORD_LAP_ERROR };

export const createInitialRaceControlsState = (): RaceControlsState => ({
  selectedCar: null,
  resetCount: 0,
  raceElapsedMs: 0,
  lapElapsedMs: 0,
  isTimerRunning: false,
  recordLapError: undefined,
});

/**
 * Local state transitions for RaceControls. It is intentionally not connected to the component
 * yet; existing handlers remain the runtime source of truth until migrated one at a time.
 */
export const raceControlsReducer = (state: RaceControlsState, action: RaceControlsAction): RaceControlsState => {
  switch (action.type) {
    case RaceControlsActionType.SELECT_CAR:
      return { ...state, selectedCar: action.selectedCar };
    case RaceControlsActionType.RESET_FOR_RUN:
      return { ...createInitialRaceControlsState(), selectedCar: state.selectedCar };
    case RaceControlsActionType.START_TIMERS:
      return { ...state, raceElapsedMs: 0, lapElapsedMs: 0, isTimerRunning: true };
    case RaceControlsActionType.PAUSE_TIMERS:
      return {
        ...state,
        raceElapsedMs: action.raceElapsedMs,
        lapElapsedMs: action.lapElapsedMs,
        isTimerRunning: false,
      };
    case RaceControlsActionType.RESUME_TIMERS:
      return { ...state, isTimerRunning: true };
    case RaceControlsActionType.TICK:
      return { ...state, raceElapsedMs: action.raceElapsedMs, lapElapsedMs: action.lapElapsedMs };
    case RaceControlsActionType.INCREMENT_RESET:
      return { ...state, resetCount: state.resetCount + 1 };
    case RaceControlsActionType.RECORD_LAP_OPTIMISTIC:
      return { ...state, resetCount: 0, lapElapsedMs: 0, recordLapError: undefined };
    case RaceControlsActionType.RECORD_LAP_REJECTED:
      return {
        ...state,
        resetCount: action.resetCount,
        lapElapsedMs: action.lapElapsedMs,
        recordLapError: action.error,
      };
    case RaceControlsActionType.CLEAR_RECORD_LAP_ERROR:
      return { ...state, recordLapError: undefined };
    default:
      return state;
  }
};
