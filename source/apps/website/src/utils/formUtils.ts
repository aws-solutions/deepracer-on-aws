// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const transformToNumber = (value: string | number = ''): string | number => {
  if (value === '') return '';

  const stringValue = String(value);
  if (stringValue.endsWith('.') || /^-?(0)?\.0+$/.test(stringValue)) return stringValue;
  const number = parseFloat(stringValue);
  return isNaN(number) ? '' : number;
};
