// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { parseDateTimeLocal, validateLiveEventDate, validateLiveEventTime } from '../validation';

describe('parseDateTimeLocal', () => {
  it('parses date and time strings into a local Date', () => {
    const result = parseDateTimeLocal('2026-04-05', '14:30');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // April = 3 (0-indexed)
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('handles midnight correctly', () => {
    const result = parseDateTimeLocal('2026-01-01', '00:00');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('validateLiveEventDate', () => {
  const createCtx = () => ({ createError: ({ message }: { message: string }) => message });

  it('returns true for a future date', () => {
    const result = validateLiveEventDate.call({} as never, '2099-01-01', createCtx() as never);
    expect(result).toBe(true);
  });

  it('returns error for a past date', () => {
    const result = validateLiveEventDate.call({} as never, '2020-01-01', createCtx() as never);
    expect(result).not.toBe(true);
  });
});

describe('validateLiveEventTime', () => {
  const createCtx = () => ({ createError: ({ message }: { message: string }) => message });

  it('returns true when liveEventDate is empty', () => {
    const result = validateLiveEventTime.call(
      { parent: { liveEventDate: '' } } as never,
      '14:00',
      createCtx() as never,
    );
    expect(result).toBe(true);
  });

  it('returns true for a future date/time', () => {
    const result = validateLiveEventTime.call(
      { parent: { liveEventDate: '2099-01-01' } } as never,
      '14:00',
      createCtx() as never,
    );
    expect(result).toBe(true);
  });

  it('returns error for a past date/time', () => {
    const result = validateLiveEventTime.call(
      { parent: { liveEventDate: '2020-01-01' } } as never,
      '14:00',
      createCtx() as never,
    );
    expect(result).not.toBe(true);
  });
});

describe('maxLap validation', () => {
  it('passes when maxLap >= minLap', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema.validateAt('maxLap', {
      maxLap: '5',
      minLap: '3',
      ranking: 'BEST_LAP_TIME',
    });
    expect(result).toBe('5');
  });

  it('fails when maxLap < minLap', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema.validateAt('maxLap', {
        maxLap: '2',
        minLap: '5',
        ranking: 'BEST_LAP_TIME',
      }),
    ).rejects.toThrow();
  });

  it('passes when maxLap === minLap for TOTAL_TIME', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema.validateAt('maxLap', {
      maxLap: '5',
      minLap: '5',
      ranking: 'TOTAL_TIME',
    });
    expect(result).toBe('5');
  });

  it('fails when maxLap !== minLap for TOTAL_TIME', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema.validateAt('maxLap', {
        maxLap: '5',
        minLap: '3',
        ranking: 'TOTAL_TIME',
      }),
    ).rejects.toThrow();
  });
});
