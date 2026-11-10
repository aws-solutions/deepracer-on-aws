// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectionStatus, useMqttSubscription } from '../useMqttSubscription.js';
import { isTimerMqttEvent, useTimerMqtt } from '../useTimerMqtt.js';

vi.mock('../useMqttSubscription.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useMqttSubscription.js')>();
  return { ...actual, useMqttSubscription: vi.fn() };
});

describe('useTimerMqtt', () => {
  it('subscribes to the per-timer topic and disables itself without an instance ID', () => {
    vi.mocked(useMqttSubscription).mockReturnValue({ connectionStatus: ConnectionStatus.CONNECTED });
    const onEvent = vi.fn();

    const { result } = renderHook(() => useTimerMqtt('mi-0123456789abcdef0', { onEvent }));

    expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTED);
    const [instanceId, buildTopic, options, config] = vi.mocked(useMqttSubscription).mock.calls[0];
    expect(instanceId).toBe('mi-0123456789abcdef0');
    expect(buildTopic('testns', 'mi-0123456789abcdef0')).toBe('deepracer/testns/timer/mi-0123456789abcdef0');
    expect(config).toEqual({ disableWhenIdEmpty: true });

    const lap = { eventType: 'TIMER_LAP', instanceId: 'mi-1', timestamp: 1000, gpio: 17, sequence: 2 } as const;
    options.onEvent(lap);
    expect(onEvent).toHaveBeenCalledWith(lap);
  });

  it.each([
    ['a string timestamp', { eventType: 'TIMER_LAP', instanceId: 'mi-1', timestamp: '1000', gpio: 17, sequence: 1 }],
    ['a missing sequence', { eventType: 'TIMER_LAP', instanceId: 'mi-1', timestamp: 1000, gpio: 17 }],
    ['a fractional sequence', { eventType: 'TIMER_LAP', instanceId: 'mi-1', timestamp: 1000, gpio: 17, sequence: 1.5 }],
    ['a NaN timestamp', { eventType: 'TIMER_HEARTBEAT', instanceId: 'mi-1', timestamp: Number.NaN }],
    ['an unknown event type', { eventType: 'OTHER', instanceId: 'mi-1', timestamp: 1000 }],
    ['no instance ID', { eventType: 'TIMER_HEARTBEAT', timestamp: 1000 }],
    [
      'a non-string bootId',
      { eventType: 'TIMER_LAP', instanceId: 'mi-1', bootId: 7, timestamp: 1000, gpio: 17, sequence: 1 },
    ],
    ['a negative publishedAt', { eventType: 'TIMER_HEARTBEAT', instanceId: 'mi-1', timestamp: 1000, publishedAt: -1 }],
    ['a non-object payload', 'TIMER_LAP'],
    ['null', null],
  ])('drops a message with %s', (_case, payload) => {
    vi.mocked(useMqttSubscription).mockReturnValue({ connectionStatus: ConnectionStatus.CONNECTED });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onEvent = vi.fn();
    renderHook(() => useTimerMqtt('mi-1', { onEvent }));

    vi.mocked(useMqttSubscription).mock.calls[0][2].onEvent(payload as never);

    expect(onEvent).not.toHaveBeenCalled();
    expect(isTimerMqttEvent(payload)).toBe(false);
  });

  it('accepts a well-formed heartbeat', () => {
    expect(isTimerMqttEvent({ eventType: 'TIMER_HEARTBEAT', instanceId: 'mi-1', timestamp: 1000 })).toBe(true);
  });

  it('accepts bootId and publishedAt, and messages from timers that predate them', () => {
    expect(
      isTimerMqttEvent({
        eventType: 'TIMER_LAP',
        instanceId: 'mi-1',
        bootId: 'boot-a',
        timestamp: 1000,
        gpio: 17,
        sequence: 1,
        publishedAt: 1200,
      }),
    ).toBe(true);
    expect(
      isTimerMqttEvent({ eventType: 'TIMER_LAP', instanceId: 'mi-1', timestamp: 1000, gpio: 17, sequence: 1 }),
    ).toBe(true);
  });
});
