// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';

import { useTimekeepingContext } from '#hooks/useTimekeepingContext';

describe('useTimekeepingContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns undefined selections when nothing has been persisted', () => {
    const { result } = renderHook(() => useTimekeepingContext());

    expect(result.current.fetchCarLogsOnRunFinish).toBe(false);
    expect(result.current.selectedEventId).toBeUndefined();
    expect(result.current.selectedLeaderboardId).toBeUndefined();
    expect(result.current.selectedEventName).toBeUndefined();
    expect(result.current.selectedTrackName).toBeUndefined();
  });

  it('persists the selected event and track names', () => {
    const { result } = renderHook(() => useTimekeepingContext());

    act(() => {
      result.current.setEventAndTrack('event-1', 'track-1', 'Event 1', 'Track 1');
    });

    expect(result.current.selectedEventId).toBe('event-1');
    expect(result.current.selectedLeaderboardId).toBe('track-1');
    expect(result.current.selectedEventName).toBe('Event 1');
    expect(result.current.selectedTrackName).toBe('Track 1');
  });

  it('persists the fetch-car-logs toggle independently from the event and track selection', () => {
    const { result } = renderHook(() => useTimekeepingContext());

    act(() => {
      result.current.setFetchCarLogsOnRunFinish(true);
    });

    expect(result.current.fetchCarLogsOnRunFinish).toBe(true);
  });

  it('reads a previously persisted selection on mount', () => {
    const { result: firstRender } = renderHook(() => useTimekeepingContext());
    act(() => {
      firstRender.current.setEventAndTrack('event-2', 'track-2', 'Event 2', 'Track 2');
    });

    const { result: secondRender } = renderHook(() => useTimekeepingContext());

    expect(secondRender.current.selectedEventId).toBe('event-2');
    expect(secondRender.current.selectedLeaderboardId).toBe('track-2');
    expect(secondRender.current.selectedEventName).toBe('Event 2');
    expect(secondRender.current.selectedTrackName).toBe('Track 2');
    expect(secondRender.current.fetchCarLogsOnRunFinish).toBe(false);
  });

  it('clears the selection', () => {
    const { result } = renderHook(() => useTimekeepingContext());

    act(() => {
      result.current.setEventAndTrack('event-1', 'track-1', 'Event 1', 'Track 1');
    });
    act(() => {
      result.current.clearEventAndTrack();
    });

    expect(result.current.selectedEventId).toBeUndefined();
    expect(result.current.selectedLeaderboardId).toBeUndefined();
    expect(result.current.selectedEventName).toBeUndefined();
    expect(result.current.selectedTrackName).toBeUndefined();
    expect(result.current.fetchCarLogsOnRunFinish).toBe(false);
  });

  it('clears names when an ID-only selection replaces a named selection', () => {
    const { result } = renderHook(() => useTimekeepingContext());

    act(() => {
      result.current.setEventAndTrack('event-1', 'track-1', 'Event 1', 'Track 1');
      result.current.setEventAndTrack('event-2', 'track-2');
    });

    expect(result.current.selectedEventId).toBe('event-2');
    expect(result.current.selectedLeaderboardId).toBe('track-2');
    expect(result.current.selectedEventName).toBeUndefined();
    expect(result.current.selectedTrackName).toBeUndefined();
  });

  it('synchronizes changes with another mounted consumer in the same tab', () => {
    const { result: firstConsumer } = renderHook(() => useTimekeepingContext());
    const { result: secondConsumer } = renderHook(() => useTimekeepingContext());

    act(() => {
      firstConsumer.current.setEventAndTrack('event-1', 'track-1', 'Event 1', 'Track 1');
    });

    expect(secondConsumer.current.selectedEventId).toBe('event-1');
    expect(secondConsumer.current.selectedLeaderboardId).toBe('track-1');
    expect(secondConsumer.current.selectedEventName).toBe('Event 1');
    expect(secondConsumer.current.selectedTrackName).toBe('Track 1');
  });
});
