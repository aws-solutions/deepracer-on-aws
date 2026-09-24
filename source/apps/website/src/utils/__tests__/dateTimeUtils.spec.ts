// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  formatTimestampWithTimeZone,
  isDateRangeInvalid,
  isEndTimeInvalidForActiveRaceEdit,
  minutesAndSecondsToMillis,
} from '../dateTimeUtils.js';

describe('formatTimestampWithTimeZone', () => {
  it('formats a timestamp as "YYYY-MM-DD HH:mm:ss (TZ)"', () => {
    // Timezone abbreviation depends on the runner, so assert the shape rather than a fixed zone.
    expect(formatTimestampWithTimeZone('2026-06-23T12:16:36Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(.+\)$/);
  });

  it('zero-pads single-digit months, days, and times', () => {
    const date = new Date(2026, 0, 5, 3, 4, 9);
    const tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value;
    expect(formatTimestampWithTimeZone(date)).toBe(`2026-01-05 03:04:09 (${tz})`);
  });

  it('returns an em dash for invalid or absent values', () => {
    expect(formatTimestampWithTimeZone(undefined)).toBe('—');
    expect(formatTimestampWithTimeZone('not-a-date')).toBe('—');
  });
});

describe('minutesAndSecondsToMillis', () => {
  it('parses a MM:SS.sss string into milliseconds', () => {
    expect(minutesAndSecondsToMillis('00:37.264')).toBe(37264);
  });

  it('parses a MM:SS string (no milliseconds) into milliseconds', () => {
    expect(minutesAndSecondsToMillis('01:05')).toBe(65000);
  });

  it('pads partial millisecond digits', () => {
    expect(minutesAndSecondsToMillis('00:01.5')).toBe(1500);
  });

  it('returns undefined for an invalid format', () => {
    expect(minutesAndSecondsToMillis('not-a-time')).toBeUndefined();
    expect(minutesAndSecondsToMillis('1:2')).toBeUndefined();
  });

  it('returns undefined when seconds are out of range', () => {
    expect(minutesAndSecondsToMillis('00:60')).toBeUndefined();
  });
});

describe('isDateRangeInvalid', () => {
  it('is invalid when the start date/time is in the past', () => {
    expect(
      isDateRangeInvalid({ startDate: '2020-01-01', startTime: '10:00', endDate: '2020-01-02', endTime: '10:00' }),
    ).toBe(true);
  });

  it('is invalid when the end date/time is at or before the start', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const startDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(isDateRangeInvalid({ startDate, startTime: '10:00', endDate: startDate, endTime: '09:00' })).toBe(true);
  });

  it('is valid for a future start with an end after it', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const startDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(isDateRangeInvalid({ startDate, startTime: '10:00', endDate: startDate, endTime: '11:00' })).toBe(false);
  });

  it('is valid when any field is empty (nothing to compare yet)', () => {
    expect(isDateRangeInvalid({ startDate: '', startTime: '', endDate: '', endTime: '' })).toBe(false);
  });
});

describe('isEndTimeInvalidForActiveRaceEdit', () => {
  it('does not flag a past start date/time as invalid — an active race has already started', () => {
    expect(
      isEndTimeInvalidForActiveRaceEdit({
        startDate: '2020-01-01',
        startTime: '10:00',
        endDate: '2099-01-01',
        endTime: '10:00',
      }),
    ).toBe(false);
  });

  it('still flags an end time at or before the (past) start time as invalid', () => {
    expect(
      isEndTimeInvalidForActiveRaceEdit({
        startDate: '2020-01-01',
        startTime: '10:00',
        endDate: '2020-01-01',
        endTime: '09:00',
      }),
    ).toBe(true);
  });

  it('flags an end time that is after the past start but still before now as invalid', () => {
    // The end time is after the (past) start, so isDateRangeInvalid's original check would
    // pass this — but it's still in the past relative to now, and the server rejects it.
    expect(
      isEndTimeInvalidForActiveRaceEdit({
        startDate: '2020-01-01',
        startTime: '10:00',
        endDate: '2020-01-01',
        endTime: '11:00',
      }),
    ).toBe(true);
  });

  it('is valid when any field is empty (nothing to compare yet)', () => {
    expect(isEndTimeInvalidForActiveRaceEdit({ startDate: '', startTime: '', endDate: '', endTime: '' })).toBe(false);
  });
});
