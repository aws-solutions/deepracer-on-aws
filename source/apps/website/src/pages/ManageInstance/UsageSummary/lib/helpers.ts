// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';

/**
 * Handles formatting of usage values by taking a value, a unit of measurement, and an optional transformation function.
 * It returns a formatted string that represents the value with the unit of measurement.
 * If the value is undefined, it returns '-/-'.
 * If the value is -1, it returns 'Unlimited'.
 * @param value - The value to format, can be a string, number, or undefined.
 * @param unitOfMeasurement - The unit of measurement to append to the value.
 * @param transformFn - An optional function to transform the value before formatting. It should take a number and return a number or string.
 * @returns - A formatted string representing the value with the unit of measurement, or special strings for undefined or unlimited values.
 */
export const formatValue = (
  value: string | number | undefined,
  unitOfMeasurement: string,
  transformFn?: (value: number) => number | string,
): string => {
  if (!value) {
    return '-/-';
  }

  const valueAsNumber = Number(value);
  if (valueAsNumber === -1) {
    return 'Unlimited';
  }

  const transformedValue = transformFn ? transformFn(valueAsNumber) : valueAsNumber;
  return `${transformedValue} ${unitOfMeasurement}`;
};

/**
 * Converts minutes to hours and formats the result to 2 decimal places.
 * @param minutes - The number of minutes to convert.
 * @returns - The equivalent number of hours, formatted to 2 decimal places.
 */
export const convertMinutesToHours = (minutes: number): number => {
  return parseFloat((minutes / 60).toFixed(2));
};

export const calculateTrainingAndEvaluationHoursUsed = (profiles: Profile[]): string => {
  const totalMinutesUsed = profiles.reduce((acc, profile) => acc + (profile.computeMinutesUsed || 0), 0);
  if (totalMinutesUsed) {
    return `${convertMinutesToHours(totalMinutesUsed).toFixed(2)} hours`;
  } else {
    return '-/-';
  }
};

export const calculateModelStorageUsed = (profiles: Profile[]): string => {
  const totalStorageUsed = profiles.reduce((acc, profile) => acc + (profile.modelStorageUsage || 0), 0);
  if (totalStorageUsed) {
    return `${(totalStorageUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else {
    return '-/-';
  }
};

export const calculateModelCount = (profiles: Profile[]): string => {
  const totalModelCount = profiles.reduce((acc, profile) => acc + (profile.modelCount || 0), 0);
  if (totalModelCount) {
    return `${totalModelCount} models`;
  } else {
    return '-/-';
  }
};
