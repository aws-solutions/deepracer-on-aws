// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { classifyCrossing, type TimerLapEvent } from '../utils';

const crossing = (sequence: number, bootId?: string): TimerLapEvent => ({
  eventType: 'TIMER_LAP',
  instanceId: 'mi-1',
  timestamp: 1000 + sequence,
  gpio: 17,
  sequence,
  ...(bootId !== undefined && { bootId }),
});

describe('classifyCrossing', () => {
  it('accepts the first crossing seen from a timer', () => {
    expect(classifyCrossing(undefined, crossing(5, 'boot-a'))).toEqual({
      isNew: true,
      timerRestarted: false,
      missedCrossings: 0,
    });
  });

  it('counts the crossings missing between two sequence numbers of the same process', () => {
    expect(classifyCrossing({ bootId: 'boot-a', sequence: 2 }, crossing(3, 'boot-a')).missedCrossings).toBe(0);
    expect(classifyCrossing({ bootId: 'boot-a', sequence: 2 }, crossing(5, 'boot-a'))).toEqual({
      isNew: true,
      timerRestarted: false,
      missedCrossings: 2,
    });
  });

  it.each([
    ['a redelivered crossing', 4],
    ['an older crossing delivered out of order', 2],
  ])('ignores %s instead of moving the sequence backwards', (_case, sequence) => {
    expect(classifyCrossing({ bootId: 'boot-a', sequence: 4 }, crossing(sequence, 'boot-a')).isNew).toBe(false);
  });

  it('treats a new bootId as a timer restart, whatever its sequence number', () => {
    expect(classifyCrossing({ bootId: 'boot-a', sequence: 9 }, crossing(1, 'boot-b'))).toEqual({
      isNew: true,
      timerRestarted: true,
      missedCrossings: 0,
    });
    expect(classifyCrossing({ bootId: 'boot-a', sequence: 1 }, crossing(9, 'boot-b')).timerRestarted).toBe(true);
  });

  it('treats a sequence going backwards as a restart for timers without a bootId', () => {
    expect(classifyCrossing({ sequence: 9 }, crossing(1)).timerRestarted).toBe(true);
    expect(classifyCrossing({ sequence: 9 }, crossing(9)).isNew).toBe(false);
    expect(classifyCrossing({ sequence: 9 }, crossing(11))).toEqual({
      isNew: true,
      timerRestarted: false,
      missedCrossings: 1,
    });
  });
});
