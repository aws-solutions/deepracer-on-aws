// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * This is a combined version of {@link Promise.all} and {@link Promise.allSettled}.
 *
 * Creates a Promise that is resolved with an array of results when all of the provided Promises
 * resolve, or rejected if any Promise is rejected. The Promise will not resolve or reject until after
 * all of the provided Promises resolve or reject.
 *
 * @param values An array of Promises.
 */
export async function waitForAll<T extends readonly unknown[] | []>(
  values: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
export async function waitForAll<T extends readonly unknown[] | []>(values: T) {
  const allSettled = await Promise.allSettled(values);

  for (const result of allSettled) {
    if (result.status === 'rejected') throw result.reason;
  }

  return allSettled.map((promise) => (promise as PromiseFulfilledResult<Awaited<T[number]>>).value);
}
