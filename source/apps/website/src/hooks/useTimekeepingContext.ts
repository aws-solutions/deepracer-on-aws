// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useSyncExternalStore } from 'react';

import {
  clearTimekeepingSelection,
  getTimekeepingSelectionSnapshot,
  setTimekeepingSelection,
  subscribeToTimekeepingSelection,
  type TimekeepingSelection,
} from '#hooks/timekeepingSelectionStore.js';

export type TimekeepingContext = TimekeepingSelection;

export interface UseTimekeepingContextResult extends TimekeepingContext {
  setEventAndTrack: (eventId: string, leaderboardId: string, eventName?: string, trackName?: string) => void;
  clearEventAndTrack: () => void;
  setFetchCarLogsOnRunFinish: (enabled: boolean) => void;
}

/**
 * Reads the persisted Event/Track selection through a cached useSyncExternalStore adapter.
 * Local writes synchronously update this tab; browser storage events update other open tabs.
 */
export const useTimekeepingContext = (): UseTimekeepingContextResult => {
  const selection = useSyncExternalStore(
    subscribeToTimekeepingSelection,
    getTimekeepingSelectionSnapshot,
    getTimekeepingSelectionSnapshot,
  );

  return useMemo(
    () => ({
      ...selection,
      setEventAndTrack: (eventId: string, leaderboardId: string, eventName?: string, trackName?: string) =>
        setTimekeepingSelection({
          fetchCarLogsOnRunFinish: selection.fetchCarLogsOnRunFinish,
          selectedEventId: eventId,
          selectedLeaderboardId: leaderboardId,
          selectedEventName: eventName,
          selectedTrackName: trackName,
        }),
      setFetchCarLogsOnRunFinish: (enabled: boolean) =>
        setTimekeepingSelection({
          ...selection,
          fetchCarLogsOnRunFinish: enabled,
        }),
      clearEventAndTrack: clearTimekeepingSelection,
    }),
    [selection],
  );
};
