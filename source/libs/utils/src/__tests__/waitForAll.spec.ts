// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { waitForAll } from '../waitForAll.js';

describe('waitForAll', () => {
  it('should resolve to an array of results if all provided promises resolve', async () => {
    const expectedResults = ['one', 'two'] as const;

    const results = await waitForAll([Promise.resolve(expectedResults[0]), Promise.resolve(expectedResults[1])]);

    expect(results).toEqual(expectedResults);
  });

  it('should reject AFTER all promises settle if a provided promise rejects', async () => {
    let resolved = false;

    const promise = new Promise<void>((resolve) => {
      setTimeout(resolve, 1);
    }).then(() => {
      resolved = true;
    });

    await expect(waitForAll([Promise.reject('rejected'), promise])).rejects.toBe('rejected');

    expect(resolved).toBe(true);
  });
});
