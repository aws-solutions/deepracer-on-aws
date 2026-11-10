// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  useMqttSubscription,
  type UseMqttSubscriptionOptions,
  type UseMqttSubscriptionReturn,
} from './useMqttSubscription.js';

export { ConnectionStatus } from './useMqttSubscription.js';

/**
 * Events published by the RPi hardware timer (`public/timer/timer.mjs`). `timestamp` is the
 * timer's own epoch-based monotonic clock in ms: only differences between two events from the
 * same timer are meaningful, so lap times are free of network latency and browser clock skew.
 */
export type TimerMqttEvent =
  | {
      eventType: 'TIMER_LAP';
      instanceId: string;
      /** Identifies the timer process; sequence and timestamp only compare within one bootId. */
      bootId?: string;
      timestamp: number;
      gpio: number;
      sequence: number;
      /** When the timer actually sent the message, on the same clock as timestamp. */
      publishedAt?: number;
    }
  | { eventType: 'TIMER_HEARTBEAT'; instanceId: string; bootId?: string; timestamp: number; publishedAt?: number };

type UseTimerMqttOptions = UseMqttSubscriptionOptions<TimerMqttEvent>;
type UseTimerMqttReturn = UseMqttSubscriptionReturn;

const buildTimerTopic = (namespace: string, instanceId: string): string => `deepracer/${namespace}/timer/${instanceId}`;

const isNonNegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/**
 * Checks a timer message's shape before it is used to time laps. Payloads are only JSON-parsed,
 * and every timer can publish to every timer topic (shared role), so a malformed message must not
 * turn into a NaN lap time.
 */
export const isTimerMqttEvent = (value: unknown): value is TimerMqttEvent => {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  if (typeof event.instanceId !== 'string' || !isNonNegativeInteger(event.timestamp)) return false;
  // Optional, so timers installed before these fields existed keep working.
  if (event.bootId !== undefined && typeof event.bootId !== 'string') return false;
  if (event.publishedAt !== undefined && !isNonNegativeInteger(event.publishedAt)) return false;
  if (event.eventType === 'TIMER_HEARTBEAT') return true;
  return event.eventType === 'TIMER_LAP' && isNonNegativeInteger(event.sequence) && isNonNegativeInteger(event.gpio);
};

/**
 * React hook for subscribing to one hardware timer's crossings and heartbeats via IoT Core MQTT
 * (topic `deepracer/{ns}/timer/{instanceId}`). A falsy instanceId disables the subscription.
 * Malformed messages are dropped. Thin wrapper over {@link useMqttSubscription}.
 */
export const useTimerMqtt = (instanceId: string, options: UseTimerMqttOptions): UseTimerMqttReturn =>
  useMqttSubscription<TimerMqttEvent>(
    instanceId,
    buildTimerTopic,
    {
      ...options,
      onEvent: (event) => {
        if (isTimerMqttEvent(event)) options.onEvent(event);
        else console.warn('Ignoring malformed timer message', { event });
      },
    },
    { disableWhenIdEmpty: true },
  );
