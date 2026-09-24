// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { countryCodeToFlagEmoji } from '../flagUtil';

describe('countryCodeToFlagEmoji', () => {
  it.each([
    ['US', '🇺🇸'],
    ['gB', '🇬🇧'],
    ['jp', '🇯🇵'],
    ['   a U     ', '🇦🇺'],
  ])('converts %s to %s regardless of input case', (countryCode, expectedFlag) => {
    expect(countryCodeToFlagEmoji(countryCode)).toBe(expectedFlag);
  });

  it.each([[undefined], [null], [123], [{}]])(
    'returns an empty string when country code is a non string: %p',
    (countryCode) => {
      expect(countryCodeToFlagEmoji(countryCode as unknown as string)).toBe('');
    },
  );

  it.each(['', 'A', 'USA', 'U S A', '    '])(
    'returns an empty string when normalized country code is not two characters: %p',
    (countryCode) => {
      expect(countryCodeToFlagEmoji(countryCode)).toBe('');
    },
  );
});
