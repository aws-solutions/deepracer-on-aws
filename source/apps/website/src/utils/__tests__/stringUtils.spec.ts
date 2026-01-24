// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { truncateString } from '../stringsUtils';

describe('string utils', () => {
  describe('truncateString()', () => {
    it('should truncate a string to a given length', () => {
      expect(truncateString('Hello World', 5)).toBe('Hello…');
      expect(truncateString('Hello', 1)).toBe('H…');
    });
  });
});
