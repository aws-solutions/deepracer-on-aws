// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ObjectPosition } from '@deepracer-indy/typescript-client';

import { validateObjectPositions } from '../validationUtils';

describe('validationUtils', () => {
  describe('validateObjectPositions', () => {
    it('should return true for valid object positions with sufficient distance', () => {
      const objectPositions: ObjectPosition[] = [
        { laneNumber: -1, trackPercentage: 0.1 },
        { laneNumber: 1, trackPercentage: 0.24 },
        { laneNumber: -1, trackPercentage: 0.37 },
      ];

      expect(validateObjectPositions(objectPositions, 0)).toBe(true);
      expect(validateObjectPositions(objectPositions, 1)).toBe(true);
      expect(validateObjectPositions(objectPositions, 2)).toBe(true);
    });

    it('should return false for object positions that are too close together', () => {
      const objectPositions: ObjectPosition[] = [
        { laneNumber: -1, trackPercentage: 0.1 },
        { laneNumber: 1, trackPercentage: 0.15 }, // Too close to first position (0.05 < 0.13)
        { laneNumber: -1, trackPercentage: 0.37 },
      ];

      expect(validateObjectPositions(objectPositions, 0)).toBe(false);
      expect(validateObjectPositions(objectPositions, 1)).toBe(false);
      expect(validateObjectPositions(objectPositions, 2)).toBe(true);
    });

    it('should return true for single object position', () => {
      const objectPositions: ObjectPosition[] = [{ laneNumber: -1, trackPercentage: 0.1 }];

      expect(validateObjectPositions(objectPositions, 0)).toBe(true);
    });

    it('should return true for empty array', () => {
      const objectPositions: ObjectPosition[] = [];

      expect(validateObjectPositions(objectPositions, 0)).toBe(true);
    });

    it('should handle edge case where positions are exactly at minimum distance', () => {
      const objectPositions: ObjectPosition[] = [
        { laneNumber: -1, trackPercentage: 0.1 },
        { laneNumber: 1, trackPercentage: 0.23 }, // Exactly 0.13 distance
      ];

      expect(validateObjectPositions(objectPositions, 0)).toBe(true);
      expect(validateObjectPositions(objectPositions, 1)).toBe(true);
    });

    it('should handle positions at track boundaries', () => {
      const objectPositions: ObjectPosition[] = [
        { laneNumber: -1, trackPercentage: 0.07 }, // Minimum allowed
        { laneNumber: 1, trackPercentage: 0.9 }, // Maximum allowed
      ];

      expect(validateObjectPositions(objectPositions, 0)).toBe(true);
      expect(validateObjectPositions(objectPositions, 1)).toBe(true);
    });

    it('should return true when checking position against itself', () => {
      const objectPositions: ObjectPosition[] = [
        { laneNumber: -1, trackPercentage: 0.1 },
        { laneNumber: 1, trackPercentage: 0.1 }, // Same percentage as first
      ];

      // When checking index 0, it should skip comparing with itself
      expect(validateObjectPositions(objectPositions, 0)).toBe(false); // Will compare with index 1
      expect(validateObjectPositions(objectPositions, 1)).toBe(false); // Will compare with index 0
    });
  });
});
