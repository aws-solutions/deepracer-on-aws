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

describe('createRaceValidationSchema — startDate/startTime for an active-race admin edit', () => {
  it('rejects a past startDate by default (creating or editing a not-yet-started race)', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema().validateAt('startDate', { isLive: false, startDate: '2020-01-01' }),
    ).rejects.toThrow();
  });

  it('accepts a past startDate when isActiveRaceAdminEdit is true', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema(true).validateAt('startDate', {
      isLive: false,
      startDate: '2020-01-01',
    });
    expect(result).toBe('2020-01-01');
  });

  it('rejects a past startTime by default', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema().validateAt('startTime', {
        isLive: false,
        startDate: '2020-01-01',
        startTime: '00:00',
      }),
    ).rejects.toThrow();
  });

  it('accepts a past startTime when isActiveRaceAdminEdit is true', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema(true).validateAt('startTime', {
      isLive: false,
      startDate: '2020-01-01',
      startTime: '00:00',
    });
    expect(result).toBe('00:00');
  });

  it('still requires startDate/startTime to be present when isActiveRaceAdminEdit is true', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema(true).validateAt('startDate', { isLive: false, startDate: '' }),
    ).rejects.toThrow();
  });

  it('rejects an endTime that is after the past startTime but still before now, when isActiveRaceAdminEdit is true', async () => {
    // The past start's own future-check is suppressed in this mode, so validateEndTime's
    // end > start check alone would let this through — validateEndTimeIsInFuture must catch it.
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema(true).validateAt('endTime', {
        isLive: false,
        startDate: '2020-01-01',
        startTime: '00:00',
        endDate: '2020-01-01',
        endTime: '01:00',
      }),
    ).rejects.toThrow();
  });

  it('accepts an endTime in the future when isActiveRaceAdminEdit is true', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema(true).validateAt('endTime', {
      isLive: false,
      startDate: '2020-01-01',
      startTime: '00:00',
      endDate: '2099-01-01',
      endTime: '10:00',
    });
    expect(result).toBe('10:00');
  });

  it('does not require endTime to be in the future when isActiveRaceAdminEdit is false', async () => {
    // Without isActiveRaceAdminEdit, startTime is itself required to be in the future, so
    // end > start already transitively implies end > now — validateEndTimeIsInFuture must
    // not additionally run and reject a genuinely-past endTime with the wrong message here.
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema(false).validateAt('endTime', {
      isLive: false,
      startDate: '2099-01-01',
      startTime: '00:00',
      endDate: '2099-01-01',
      endTime: '01:00',
    });
    expect(result).toBe('01:00');
  });
});

describe('maxLap validation', () => {
  it('passes when maxLap >= minLap', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema().validateAt('maxLap', {
      maxLap: '5',
      minLap: '3',
      ranking: 'BEST_LAP_TIME',
    });
    expect(result).toBe('5');
  });

  it('fails when maxLap < minLap', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema().validateAt('maxLap', {
        maxLap: '2',
        minLap: '5',
        ranking: 'BEST_LAP_TIME',
      }),
    ).rejects.toThrow();
  });

  it('passes when maxLap === minLap for TOTAL_TIME', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    const result = await createRaceValidationSchema().validateAt('maxLap', {
      maxLap: '5',
      minLap: '5',
      ranking: 'TOTAL_TIME',
    });
    expect(result).toBe('5');
  });

  it('fails when maxLap !== minLap for TOTAL_TIME', async () => {
    const { createRaceValidationSchema } = await import('../validation');
    await expect(
      createRaceValidationSchema().validateAt('maxLap', {
        maxLap: '5',
        minLap: '3',
        ranking: 'TOTAL_TIME',
      }),
    ).rejects.toThrow();
  });
});
