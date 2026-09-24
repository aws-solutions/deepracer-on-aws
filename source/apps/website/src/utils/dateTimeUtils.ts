// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Formats an epoch millisecond time as MM:SS.sss.
 *
 * @param millis Epoch time in milliseconds
 * @returns MM:SS.sss
 *
 * @example
 * millisToMinutesAndSeconds(37264) // "00:37.264"
 */
export const millisToMinutesAndSeconds = (millis?: number) => {
  if (!millis) return '--';
  return new Date(millis).toISOString().slice(14, 23);
};

/**
 * Parses a MM:SS or MM:SS.sss formatted string into milliseconds. This is the inverse of
 * {@link millisToMinutesAndSeconds}.
 *
 * @param value A string in MM:SS or MM:SS.sss format
 * @returns The equivalent number of milliseconds, or `undefined` if `value` doesn't match the expected format
 *
 * @example
 * minutesAndSecondsToMillis('00:37.264') // 37264
 * minutesAndSecondsToMillis('01:05') // 65000
 */
export const minutesAndSecondsToMillis = (value: string): number | undefined => {
  const match = /^(\d+):(\d{2})(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return undefined;

  const [, minutesText, secondsText, millisText = ''] = match;
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (seconds > 59) return undefined;

  const millis = Number(millisText.padEnd(3, '0'));
  return minutes * 60_000 + seconds * 1_000 + millis;
};

/**
 * Returns a string representing the current UTC offset and timezone.
 *
 * @example
 * // PST
 * getUTCOffsetTimeZoneText() // "UTC-0800 (Pacific Standard Time) America/Los_Angeles"
 */
export const getUTCOffsetTimeZoneText = () => {
  const utcOffset = `UTC${new Date().toString().split('GMT')[1]}`;
  const timeZoneText = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${utcOffset} ${timeZoneText}`;
};

/**
 * Formats a timestamp as `YYYY-MM-DD HH:mm:ss (TZ)` in the viewer's local time zone,
 * where TZ is the short zone abbreviation.
 *
 * @param value ISO string, epoch millis, or Date
 * @returns e.g. "2026-06-23 08:16:36 (EDT)", or "—" for an invalid/absent value
 */
export const formatTimestampWithTimeZone = (value?: string | number | Date): string => {
  if (value === undefined || value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const pad = (n: number): string => String(n).padStart(2, '0');
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const timeZone =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';

  return `${datePart} ${timePart} (${timeZone})`;
};

export const getRacingTimeGap = (t1?: number, t2?: number, includeLeadingPlus = true) => {
  if (typeof t1 !== 'number' || typeof t2 !== 'number') {
    return '--';
  }
  const gap = Math.abs(t1 - t2);

  return gap ? `${includeLeadingPlus ? '+' : ''}${millisToMinutesAndSeconds(gap)}` : '--';
};
export const isDateRangeInvalid = ({
  startDate,
  startTime,
  endDate,
  endTime,
}: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}) => {
  const currentDate = new Date();
  return (
    startDate !== '' &&
    startTime !== '' &&
    (new Date(startDate + ' ' + startTime) < currentDate ||
      (endDate !== '' && endTime !== '' && new Date(startDate + ' ' + startTime) >= new Date(endDate + ' ' + endTime)))
  );
};

/**
 * Like {@link isDateRangeInvalid}, but for an active-race admin edit, where the start
 * date/time is expected to already be in the past (the race has started) — that condition
 * must not flag endTime as invalid. Still flags endTime when it's at or before the
 * (already-past) start, or when it's not actually in the future, since neither is a valid
 * end time for an active race regardless of edit mode (the server rejects both).
 */
export const isEndTimeInvalidForActiveRaceEdit = ({
  startDate,
  startTime,
  endDate,
  endTime,
}: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}) => {
  if (startDate === '' || startTime === '' || endDate === '' || endTime === '') return false;

  const end = new Date(endDate + ' ' + endTime);
  return new Date(startDate + ' ' + startTime) >= end || end <= new Date();
};
