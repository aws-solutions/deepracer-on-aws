// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mapWithConcurrency } from '../mapWithConcurrency.js';

describe('mapWithConcurrency', () => {
  it('maps items in order while respecting the concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5];
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency(items, 2, async (item, index) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return `${index}:${item * 2}`;
    });

    expect(results).toEqual(['0:2', '1:4', '2:6', '3:8', '4:10']);
    expect(maxActive).toBe(2);
  });

  it('returns an empty array without invoking the mapper for empty input', async () => {
    const mapper = vi.fn<(item: number, index: number) => Promise<number>>();

    await expect(mapWithConcurrency([], 2, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it('rejects when the mapper rejects', async () => {
    const mapperError = new Error('mapper failed');

    await expect(
      mapWithConcurrency([1, 2], 2, async (item) => {
        if (item === 2) {
          throw mapperError;
        }
        return item;
      }),
    ).rejects.toBe(mapperError);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects an invalid concurrency limit: %s', async (concurrency) => {
    await expect(mapWithConcurrency([1], concurrency, async (item) => item)).rejects.toThrow(
      'Concurrency must be a positive integer',
    );
  });
});
