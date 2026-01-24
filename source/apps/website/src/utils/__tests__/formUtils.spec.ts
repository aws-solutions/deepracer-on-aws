// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { transformToNumber } from '../formUtils';

describe('form utils', () => {
  describe('transformToNumber()', () => {
    it('should transform a valid number string to a number', () => {
      expect(transformToNumber('123')).toBe(123);
      expect(transformToNumber('1.25')).toBe(1.25);
      expect(transformToNumber('0.01')).toBe(0.01);
    });

    it('should return empty string for empty input', () => {
      expect(transformToNumber('')).toBe('');
    });

    it('should return empty string for non-number string', () => {
      expect(transformToNumber('abc')).toBe('');
    });

    it('should preserve trailing decimal point while typing', () => {
      expect(transformToNumber('5.')).toBe('5.');
      expect(transformToNumber('123.')).toBe('123.');
      expect(transformToNumber('0.')).toBe('0.');
    });

    it('should preserve leading zeros in decimal numbers while typing', () => {
      expect(transformToNumber('0.0')).toBe('0.0');
      expect(transformToNumber('0.00')).toBe('0.00');
      expect(transformToNumber('0.000')).toBe('0.000');
      expect(transformToNumber('.0')).toBe('.0');
      expect(transformToNumber('.00')).toBe('.00');
    });

    it('should handle number inputs', () => {
      expect(transformToNumber(123)).toBe(123);
      expect(transformToNumber(1.25)).toBe(1.25);
      expect(transformToNumber(0)).toBe(0);
      expect(transformToNumber(-5)).toBe(-5);
      expect(transformToNumber(0.01)).toBe(0.01);
    });
  });
});
