// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';
import { describe, it, expect } from 'vitest';

import {
  formatValue,
  convertMinutesToHours,
  calculateTrainingAndEvaluationHoursUsed,
  calculateModelStorageUsed,
  calculateModelCount,
} from '../helpers';

describe('helpers', () => {
  describe('formatValue', () => {
    it('should return "-/-" when value is undefined', () => {
      expect(formatValue(undefined, 'units')).toBe('-/-');
    });

    it('should return "-/-" when value is null', () => {
      expect(formatValue(null as unknown as undefined, 'units')).toBe('-/-');
    });

    it('should return "-/-" when value is 0', () => {
      expect(formatValue(0, 'units')).toBe('-/-');
    });

    it('should return "Unlimited" when value is -1', () => {
      expect(formatValue(-1, 'units')).toBe('Unlimited');
    });

    it('should format a number value with the unit of measurement', () => {
      expect(formatValue(42, 'hours')).toBe('42 hours');
    });

    it('should format a string value (that can be converted to a number) with the unit of measurement', () => {
      expect(formatValue('42', 'hours')).toBe('42 hours');
    });

    it('should apply the transform function when provided', () => {
      const transformFn = (value: number) => value * 2;
      expect(formatValue(42, 'hours', transformFn)).toBe('84 hours');
    });

    it('should apply the transform function that returns a string when provided', () => {
      const transformFn = (value: number) => `${value.toFixed(2)}`;
      expect(formatValue(42, 'hours', transformFn)).toBe('42.00 hours');
    });
  });

  describe('convertMinutesToHours', () => {
    it('should convert minutes to hours with 2 decimal places', () => {
      expect(convertMinutesToHours(60)).toBe(1);
    });

    it('should handle fractional hours correctly', () => {
      expect(convertMinutesToHours(90)).toBe(1.5);
    });

    it('should round to 2 decimal places', () => {
      expect(convertMinutesToHours(61)).toBe(1.02);
    });

    it('should handle large values', () => {
      expect(convertMinutesToHours(6000)).toBe(100);
    });

    it('should handle zero', () => {
      expect(convertMinutesToHours(0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(convertMinutesToHours(-60)).toBe(-1);
    });
  });

  describe('calculateTrainingAndEvaluationHoursUsed', () => {
    it('should return "-/-" when there are no profiles', () => {
      expect(calculateTrainingAndEvaluationHoursUsed([])).toBe('-/-');
    });

    it('should return "-/-" when all profiles have 0 computeMinutesUsed', () => {
      const profiles = [{ computeMinutesUsed: 0 }, { computeMinutesUsed: 0 }] as Profile[];
      expect(calculateTrainingAndEvaluationHoursUsed(profiles)).toBe('-/-');
    });

    it('should return "-/-" when all profiles have undefined computeMinutesUsed', () => {
      const profiles = [{ computeMinutesUsed: undefined }, { computeMinutesUsed: undefined }] as Profile[];
      expect(calculateTrainingAndEvaluationHoursUsed(profiles)).toBe('-/-');
    });

    it('should calculate total hours correctly for multiple profiles', () => {
      const profiles = [
        { computeMinutesUsed: 60 },
        { computeMinutesUsed: 30 },
        { computeMinutesUsed: 90 },
      ] as Profile[];
      expect(calculateTrainingAndEvaluationHoursUsed(profiles)).toBe('3.00 hours');
    });

    it('should handle mixed undefined and defined values', () => {
      const profiles = [
        { computeMinutesUsed: 60 },
        { computeMinutesUsed: undefined },
        { computeMinutesUsed: 90 },
      ] as Profile[];
      expect(calculateTrainingAndEvaluationHoursUsed(profiles)).toBe('2.50 hours');
    });
  });

  describe('calculateModelStorageUsed', () => {
    it('should return "-/-" when there are no profiles', () => {
      expect(calculateModelStorageUsed([])).toBe('-/-');
    });

    it('should return "-/-" when all profiles have 0 modelStorageUsage', () => {
      const profiles = [{ modelStorageUsage: 0 }, { modelStorageUsage: 0 }] as Profile[];
      expect(calculateModelStorageUsed(profiles)).toBe('-/-');
    });

    it('should return "-/-" when all profiles have undefined modelStorageUsage', () => {
      const profiles = [{ modelStorageUsage: undefined }, { modelStorageUsage: undefined }] as Profile[];
      expect(calculateModelStorageUsed(profiles)).toBe('-/-');
    });

    it('should calculate total GB correctly for multiple profiles', () => {
      const storage = 1024 * 1024 * 1024;
      const profiles = [
        { modelStorageUsage: storage },
        { modelStorageUsage: storage * 2 },
        { modelStorageUsage: storage * 0.5 },
      ] as Profile[];
      expect(calculateModelStorageUsed(profiles)).toBe('3.50 GB');
    });

    it('should handle mixed undefined and defined values', () => {
      const storage = 1024 * 1024 * 1024;
      const profiles = [
        { modelStorageUsage: storage },
        { modelStorageUsage: undefined },
        { modelStorageUsage: storage * 2 },
      ] as Profile[];
      expect(calculateModelStorageUsed(profiles)).toBe('3.00 GB');
    });
  });

  describe('calculateModelCount', () => {
    it('should return "-/-" when there are no profiles', () => {
      expect(calculateModelCount([])).toBe('-/-');
    });

    it('should return "-/-" when all profiles have 0 modelCount', () => {
      const profiles = [{ modelCount: 0 }, { modelCount: 0 }] as Profile[];
      expect(calculateModelCount(profiles)).toBe('-/-');
    });

    it('should return "-/-" when all profiles have undefined modelCount', () => {
      const profiles = [{ modelCount: undefined }, { modelCount: undefined }] as Profile[];
      expect(calculateModelCount(profiles)).toBe('-/-');
    });

    it('should calculate total model count correctly for multiple profiles', () => {
      const profiles = [{ modelCount: 5 }, { modelCount: 3 }, { modelCount: 2 }] as Profile[];
      expect(calculateModelCount(profiles)).toBe('10 models');
    });

    it('should handle mixed undefined and defined values', () => {
      const profiles = [{ modelCount: 5 }, { modelCount: undefined }, { modelCount: 2 }] as Profile[];
      expect(calculateModelCount(profiles)).toBe('7 models');
    });
  });
});
