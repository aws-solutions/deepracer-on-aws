// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { generateUlid } from '../resourceUtils.js';

describe('generateUlid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a 26-char Crockford base32 (uppercase, no I/L/O/U) ULID', () => {
    expect(generateUlid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateUlid()));
    expect(ids.size).toBe(1000);
  });

  it('is lexicographically time-ordered — a later timestamp sorts after an earlier one', () => {
    // The 48-bit timestamp prefix is what makes the DynamoDB sort key chronological.
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
    const earlier = generateUlid();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_060_000);
    const later = generateUlid();
    expect(later > earlier).toBe(true);
  });
});
