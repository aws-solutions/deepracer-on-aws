// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Converts a two-letter ISO 3166-1 alpha-2 country code to its flag emoji.
 * Mirrors DREM's `components/flag.tsx` (`countryToFlag`).
 */
export const countryCodeToFlagEmoji = (countryCode: string): string => {
  if (typeof countryCode !== 'string') return '';

  const normalizedCountryCode = countryCode.replace(/\s/g, '');
  if (normalizedCountryCode.length !== 2) return '';

  return normalizedCountryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint((char.codePointAt(0) ?? 0) + 127397));
};
