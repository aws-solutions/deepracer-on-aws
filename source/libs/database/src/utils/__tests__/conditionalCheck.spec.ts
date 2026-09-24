// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { isConditionalCheckFailure } from '../conditionalCheck.js';

describe('isConditionalCheckFailure()', () => {
  it('should return true when error.name is ConditionalCheckFailedException', () => {
    const error = { name: 'ConditionalCheckFailedException' };
    expect(isConditionalCheckFailure(error)).toBe(true);
  });

  it('should return true when error.cause.name is ConditionalCheckFailedException (ElectroDB-wrapped case)', () => {
    const error = { cause: { name: 'ConditionalCheckFailedException' } };
    expect(isConditionalCheckFailure(error)).toBe(true);
  });

  it('should return true when error.message includes "conditional request failed"', () => {
    const error = { message: 'The conditional request failed' };
    expect(isConditionalCheckFailure(error)).toBe(true);
  });

  it('should return false when none of the known signatures match', () => {
    const error = { name: 'SomeOtherError', message: 'Something went wrong' };
    expect(isConditionalCheckFailure(error)).toBe(false);
  });

  it('should return false and not throw when error is null', () => {
    expect(() => isConditionalCheckFailure(null)).not.toThrow();
    expect(isConditionalCheckFailure(null)).toBe(false);
  });

  it('should return false and not throw when error is undefined', () => {
    expect(() => isConditionalCheckFailure(undefined)).not.toThrow();
    expect(isConditionalCheckFailure(undefined)).toBe(false);
  });

  it('should return false and not throw when error is a primitive (not an object)', () => {
    expect(() => isConditionalCheckFailure('some string error')).not.toThrow();
    expect(isConditionalCheckFailure('some string error')).toBe(false);
  });
});
