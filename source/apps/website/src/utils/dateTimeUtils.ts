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
