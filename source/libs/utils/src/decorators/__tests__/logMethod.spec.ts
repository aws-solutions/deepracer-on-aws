// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { MockInstance } from 'vitest';

import { logMethod } from '#decorators/logMethod.js';
import { logger } from '#powertools/powertools.js';

class TestClass {
  @logMethod
  add(n1: number, n2: number, throwErr = false) {
    if (throwErr) throw new Error('Exception Message');
    return n1 + n2;
  }
  @logMethod
  async addAsync(n1: number, n2: number, throwErr = false) {
    if (throwErr) throw new Error('Exception Message');
    return n1 + n2;
  }
}

describe('logMethod', () => {
  let loggerInfoSpy: MockInstance<(typeof logger)['info']>;
  let loggerErrorSpy: MockInstance<(typeof logger)['error']>;

  const testClass = new TestClass();

  beforeEach(() => {
    loggerInfoSpy = vi.spyOn(logger, 'info');
    loggerErrorSpy = vi.spyOn(logger, 'error');
  });

  it.each([
    [1, 2],
    [3, 4],
  ])('should log the input and output for a decorated method that succeeds', (...args) => {
    const result = testClass.add(...args);

    expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, `START ${TestClass.name}.add()`, { input: args });
    expect(loggerInfoSpy).toHaveBeenNthCalledWith(2, `END ${TestClass.name}.add()`, { output: result });
  });

  it.each([
    [1, 2],
    [3, 4],
  ])('should log the input and output for an async decorated method that succeeds', async (...args) => {
    const result = await testClass.addAsync(...args);

    expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, `START ${TestClass.name}.addAsync()`, { input: args });
    expect(loggerInfoSpy).toHaveBeenNthCalledWith(2, `END ${TestClass.name}.addAsync()`, { output: result });
  });

  it('should log the exception for a decorated method that throws', () => {
    let exception;
    const args = [1, 2, true] as const;

    try {
      testClass.add(...args);
    } catch (e) {
      exception = e;
      // no-op
    }

    expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, `START ${TestClass.name}.add()`, { input: args });
    expect(loggerErrorSpy).toHaveBeenNthCalledWith(1, `EXCEPTION ${TestClass.name}.add()`, { error: exception });
  });

  it('should log the exception for an async decorated method that throws', async () => {
    let exception;
    const args = [1, 2, true] as const;

    try {
      await testClass.addAsync(...args);
    } catch (e) {
      exception = e;
      // no-op
    }

    expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, `START ${TestClass.name}.addAsync()`, { input: args });
    expect(loggerErrorSpy).toHaveBeenNthCalledWith(1, `EXCEPTION ${TestClass.name}.addAsync()`, { error: exception });
  });
});
