// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { calculateComputeHours, calculateComputeMinutes, getCheckboxValue } from '../helpers';

describe('QuotasModal helpers', () => {
  describe('calculateComputeHours', () => {
    it('should return -1 when input is -1 (unlimited)', () => {
      expect(calculateComputeHours(-1)).toBe(-1);
    });

    it('should convert minutes to hours and round the result', () => {
      expect(calculateComputeHours(60)).toBe(1);
      expect(calculateComputeHours(120)).toBe(2);
      expect(calculateComputeHours(180)).toBe(3);
    });

    it('should handle zero minutes', () => {
      expect(calculateComputeHours(0)).toBe(0);
    });

    it('should round fractional hours correctly', () => {
      expect(calculateComputeHours(90)).toBe(2);
      expect(calculateComputeHours(30)).toBe(1);
      expect(calculateComputeHours(45)).toBe(1);
      expect(calculateComputeHours(75)).toBe(1);
      expect(calculateComputeHours(105)).toBe(2);
    });

    it('should handle large minute values', () => {
      expect(calculateComputeHours(3600)).toBe(60);
      expect(calculateComputeHours(7200)).toBe(120);
    });

    it('should handle edge case of 1 minute', () => {
      expect(calculateComputeHours(1)).toBe(0);
    });

    it('should handle edge case of 29 minutes (rounds down)', () => {
      expect(calculateComputeHours(29)).toBe(0);
    });

    it('should handle edge case of 31 minutes (rounds up)', () => {
      expect(calculateComputeHours(31)).toBe(1);
    });
  });

  describe('calculateComputeMinutes', () => {
    it('should return -1 when input is -1 (unlimited)', () => {
      expect(calculateComputeMinutes(-1)).toBe(-1);
    });

    it('should convert hours to minutes', () => {
      expect(calculateComputeMinutes(1)).toBe(60);
      expect(calculateComputeMinutes(2)).toBe(120);
      expect(calculateComputeMinutes(3)).toBe(180);
    });

    it('should handle zero hours', () => {
      expect(calculateComputeMinutes(0)).toBe(0);
    });

    it('should handle fractional hours', () => {
      expect(calculateComputeMinutes(0.5)).toBe(30);
      expect(calculateComputeMinutes(1.5)).toBe(90);
      expect(calculateComputeMinutes(2.25)).toBe(135);
    });

    it('should handle large hour values', () => {
      expect(calculateComputeMinutes(24)).toBe(1440);
      expect(calculateComputeMinutes(100)).toBe(6000);
    });

    it('should handle decimal precision correctly', () => {
      expect(calculateComputeMinutes(1.1)).toBe(66);
      expect(calculateComputeMinutes(0.1)).toBe(6);
    });
  });

  describe('getCheckboxValue', () => {
    it('should return -1 when checkbox is checked (unlimited)', () => {
      expect(getCheckboxValue(true)).toBe(-1);
    });

    it('should return 0 when checkbox is unchecked (limited)', () => {
      expect(getCheckboxValue(false)).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should maintain consistency between calculateComputeHours and calculateComputeMinutes for unlimited values', () => {
      const unlimited = -1;
      const hours = calculateComputeHours(unlimited);
      const backToMinutes = calculateComputeMinutes(hours);

      expect(hours).toBe(-1);
      expect(backToMinutes).toBe(-1);
    });

    it('should maintain reasonable consistency for round-trip conversions', () => {
      const testMinutes = [0, 60, 120, 180, 240, 300, 360];

      testMinutes.forEach((minutes) => {
        const hours = calculateComputeHours(minutes);
        const backToMinutes = calculateComputeMinutes(hours);

        const difference = Math.abs(minutes - backToMinutes);
        expect(difference).toBeLessThanOrEqual(30);
      });
    });

    it('should handle checkbox state to value conversion correctly', () => {
      const checkedValue = getCheckboxValue(true);
      expect(checkedValue).toBe(-1);

      const hoursFromChecked = calculateComputeHours(checkedValue);
      const minutesFromChecked = calculateComputeMinutes(hoursFromChecked);

      expect(hoursFromChecked).toBe(-1);
      expect(minutesFromChecked).toBe(-1);
    });

    it('should handle unchecked checkbox to conversion flow', () => {
      const uncheckedValue = getCheckboxValue(false);
      expect(uncheckedValue).toBe(0);

      const hoursFromUnchecked = calculateComputeHours(uncheckedValue);
      const minutesFromUnchecked = calculateComputeMinutes(hoursFromUnchecked);

      expect(hoursFromUnchecked).toBe(0);
      expect(minutesFromUnchecked).toBe(0);
    });
  });
});
