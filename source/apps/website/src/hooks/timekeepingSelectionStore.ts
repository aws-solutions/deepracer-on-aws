// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface TimekeepingSelection {
  selectedEventId: string | undefined;
  selectedLeaderboardId: string | undefined;
  selectedEventName: string | undefined;
  selectedTrackName: string | undefined;
}

const STORAGE_KEY = 'deepracer-timekeeping-selected-event-and-track';
const EMPTY_SELECTION: TimekeepingSelection = {
  selectedEventId: undefined,
  selectedLeaderboardId: undefined,
  selectedEventName: undefined,
  selectedTrackName: undefined,
};

let cachedSerialized: string | null | undefined;
let cachedSelection = EMPTY_SELECTION;
const listeners = new Set<() => void>();

const deserialize = (serialized: string | null): TimekeepingSelection => {
  if (!serialized) return EMPTY_SELECTION;
  try {
    const parsed = JSON.parse(serialized) as Partial<TimekeepingSelection>;
    return {
      selectedEventId: parsed.selectedEventId,
      selectedLeaderboardId: parsed.selectedLeaderboardId,
      selectedEventName: parsed.selectedEventName,
      selectedTrackName: parsed.selectedTrackName,
    };
  } catch {
    return EMPTY_SELECTION;
  }
};

const readSelection = (): TimekeepingSelection => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized !== cachedSerialized) {
      cachedSerialized = serialized;
      cachedSelection = deserialize(serialized);
    }
    return cachedSelection;
  } catch {
    return EMPTY_SELECTION;
  }
};

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

export const getTimekeepingSelectionSnapshot = (): TimekeepingSelection => readSelection();

export const subscribeToTimekeepingSelection = (listener: () => void): (() => void) => {
  const browserWindow = globalThis.window;
  if (!browserWindow) return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cachedSerialized = event.newValue;
    cachedSelection = deserialize(event.newValue);
    listener();
  };

  listeners.add(listener);
  browserWindow.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    browserWindow.removeEventListener('storage', handleStorage);
  };
};

export const setTimekeepingSelection = (selection: TimekeepingSelection): void => {
  const previousSelection = readSelection();
  const previousSerialized = cachedSerialized;
  const serialized = JSON.stringify(selection);
  if (serialized === previousSerialized) return;

  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    cachedSerialized = serialized;
    cachedSelection = selection;
  } catch {
    cachedSerialized = previousSerialized;
    cachedSelection = previousSelection;
  }
  notify();
};

export const clearTimekeepingSelection = (): void => setTimekeepingSelection(EMPTY_SELECTION);
