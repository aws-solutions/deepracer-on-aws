// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getTimekeepingSelectionSnapshot,
  setTimekeepingSelection,
  subscribeToTimekeepingSelection,
} from '#hooks/timekeepingSelectionStore';

describe('timekeepingSelectionStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns a stable empty selection when storage reads fail', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });

    const firstSnapshot = getTimekeepingSelectionSnapshot();
    const secondSnapshot = getTimekeepingSelectionSnapshot();

    expect(firstSnapshot).toEqual({
      fetchCarLogsOnRunFinish: false,
      selectedEventId: undefined,
      selectedLeaderboardId: undefined,
      selectedEventName: undefined,
      selectedTrackName: undefined,
    });
    expect(secondSnapshot).toBe(firstSnapshot);
  });

  it('does not throw and retains the previous persisted selection when storage writes fail', () => {
    const persistedSelection = {
      fetchCarLogsOnRunFinish: true,
      selectedEventId: 'event-1',
      selectedLeaderboardId: 'leaderboard-1',
      selectedEventName: 'Event 1',
      selectedTrackName: 'Track 1',
    };
    setTimekeepingSelection(persistedSelection);

    const subscriberSnapshots: ReturnType<typeof getTimekeepingSelectionSnapshot>[] = [];
    const unsubscribe = subscribeToTimekeepingSelection(() => {
      subscriberSnapshots.push(getTimekeepingSelectionSnapshot());
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });

    expect(() =>
      setTimekeepingSelection({
        fetchCarLogsOnRunFinish: false,
        selectedEventId: 'event-2',
        selectedLeaderboardId: 'leaderboard-2',
        selectedEventName: 'Event 2',
        selectedTrackName: 'Track 2',
      }),
    ).not.toThrow();

    expect(subscriberSnapshots).toEqual([persistedSelection]);
    expect(getTimekeepingSelectionSnapshot()).toEqual(persistedSelection);
    unsubscribe();
  });

  it('returns a safe no-op unsubscribe function when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    const unsubscribe = subscribeToTimekeepingSelection(vi.fn());

    expect(() => unsubscribe()).not.toThrow();
  });
});
