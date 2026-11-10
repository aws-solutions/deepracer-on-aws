// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TimerMqttEvent } from '#hooks/useTimerMqtt.js';

export const formatCountdown = (milliseconds: number | undefined): string => {
  if (milliseconds === undefined) return '--:--';

  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const formatLapTime = (milliseconds: number): string => {
  const safeMilliseconds = Math.max(0, milliseconds);
  const minutes = Math.floor(safeMilliseconds / 60000);
  const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
  const remainder = safeMilliseconds % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(remainder).padStart(3, '0')}`;
};

export type TimerLapEvent = Extract<TimerMqttEvent, { eventType: 'TIMER_LAP' }>;

export interface SeenCrossing {
  bootId?: string;
  sequence: number;
}

/**
 * Compares a crossing with the last one seen from the timer. A new bootId means the timer process
 * restarted, so sequence numbers and timestamps start over and can't be compared. Within one
 * process the sequence only moves forward: anything else is a redelivery or an out-of-order copy.
 * Timers that predate bootId are treated as restarted when their sequence goes backwards.
 */
export const classifyCrossing = (previous: SeenCrossing | undefined, event: TimerLapEvent) => {
  if (previous === undefined) return { isNew: true, timerRestarted: false, missedCrossings: 0 };
  const legacyRestart = event.bootId === undefined && event.sequence < previous.sequence;
  if (event.bootId !== previous.bootId || legacyRestart) {
    return { isNew: true, timerRestarted: true, missedCrossings: 0 };
  }
  if (event.sequence <= previous.sequence) return { isNew: false, timerRestarted: false, missedCrossings: 0 };
  return { isNew: true, timerRestarted: false, missedCrossings: event.sequence - previous.sequence - 1 };
};
