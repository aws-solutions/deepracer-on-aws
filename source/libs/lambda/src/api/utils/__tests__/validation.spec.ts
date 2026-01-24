// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError, CarColor, CarShell, TrackDirection, TrackId } from '@deepracer-indy/typescript-server-client';

import { ProfileQuotaUsage } from '../../../utils/UsageQuotaHelper.js';
import {
  validateCarCustomization,
  validateContinuousActionSpace,
  validateObjectAvoidanceConfig,
  validateTerminationConditions,
  validateTrackConfig,
  validateRacerComputeLimits,
} from '../validation.js';

describe('validation.ts', () => {
  describe('validateContinuousActionSpace', () => {
    const CONTINUOUS_ACTION_SPACE = {
      lowSpeed: 1,
      highSpeed: 3,
      lowSteeringAngle: -10,
      highSteeringAngle: 10,
    };

    it('should throw error if action space speed is invalid', () => {
      expect.assertions(1);
      expect(() => validateContinuousActionSpace({ ...CONTINUOUS_ACTION_SPACE, lowSpeed: 4 })).toThrow(
        'Invalid action space speeds.',
      );
    });

    it('should throw error if action space steering angle is invalid', () => {
      expect.assertions(1);
      expect(() => validateContinuousActionSpace({ ...CONTINUOUS_ACTION_SPACE, lowSteeringAngle: 11 })).toThrow(
        'Invalid action space steering angles.',
      );
    });
  });

  describe('validateObjectAvoidanceConfig', () => {
    it('should throw error if invalid object avoidance config', () => {
      expect.assertions(5);
      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 7,
          objectPositions: [
            { trackPercentage: 0.2, laneNumber: 1 },
            { trackPercentage: 0.4, laneNumber: 1 },
          ],
        }),
      ).toThrow('Number of obstacle positions is invalid.');
      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 3,
          objectPositions: [
            { trackPercentage: 0.001, laneNumber: 1 },
            { trackPercentage: 0.4, laneNumber: 1 },
          ],
        }),
      ).toThrow('Obstacle positions must be equal to number of objects.');
      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 2,
          objectPositions: [
            { trackPercentage: 0.001, laneNumber: 1 },
            { trackPercentage: 0.4, laneNumber: 1 },
          ],
        }),
      ).toThrow('First obstacle position is invalid.');
      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 2,
          objectPositions: [
            { trackPercentage: 1, laneNumber: 1 },
            { trackPercentage: 0.4, laneNumber: 1 },
          ],
        }),
      ).toThrow('Last obstacle position is invalid.');
      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 2,
          objectPositions: [
            { trackPercentage: 0.1, laneNumber: 1 },
            { trackPercentage: 0.11, laneNumber: 1 },
          ],
        }),
      ).toThrow('Obstacle position distances are invalid.');
    });

    it('should accept both empty array and undefined objectPositions for randomized locations', () => {
      // Both empty array and undefined should be valid for randomized positions
      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 3,
          objectPositions: [], // Empty array should be valid
        }),
      ).not.toThrow();

      expect(() =>
        validateObjectAvoidanceConfig({
          numberOfObjects: 3,
          // objectPositions undefined should be valid
        }),
      ).not.toThrow();
    });
  });

  describe('validateTerminationConditions', () => {
    it('should throw error if termination condition is invalid', () => {
      expect.assertions(2);
      expect(() => validateTerminationConditions(1)).toThrow('Max time in minutes is invalid.');
      expect(() => validateTerminationConditions(2000)).toThrow('Max time in minutes is invalid.');
    });
  });

  describe('validateCarCustomization', () => {
    it('should throw BadRequestError for invalid car customization', () => {
      expect(() => validateCarCustomization({ carColor: CarColor.BLACK, carShell: CarShell.F1 })).toThrowError(
        BadRequestError,
      );
      expect(() => validateCarCustomization({ carColor: CarColor.YELLOW, carShell: CarShell.BIKE })).toThrowError(
        BadRequestError,
      );
      expect(() => validateCarCustomization({ carColor: CarColor.BLACK, carShell: CarShell.COMPACT })).toThrowError(
        BadRequestError,
      );
      expect(() =>
        validateCarCustomization({ carColor: CarColor.GOLDENPINK, carShell: CarShell.DEEPRACER }),
      ).toThrowError(BadRequestError);
    });

    it('should not throw error for valid car customization', () => {
      expect(() => validateCarCustomization({ carColor: CarColor.BLACK, carShell: CarShell.DEEPRACER })).not.toThrow();
      expect(() => validateCarCustomization({ carColor: CarColor.YELLOW, carShell: CarShell.CLOWN })).not.toThrow();
    });
  });

  describe('validateTrackConfig', () => {
    it('should throw BadRequestError for invalid track config', () => {
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.CLOCKWISE, trackId: TrackId.DBRO_RACEWAY }),
      ).toThrowError(BadRequestError);
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.COUNTER_CLOCKWISE, trackId: TrackId.YUN_SPEEDWAY }),
      ).toThrowError(BadRequestError);
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.COUNTER_CLOCKWISE, trackId: TrackId.STRATUS_LOOP }),
      ).toThrowError(BadRequestError);
    });

    it('should not throw error for valid track config', () => {
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.COUNTER_CLOCKWISE, trackId: TrackId.DBRO_RACEWAY }),
      ).not.toThrow();
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.CLOCKWISE, trackId: TrackId.YUN_SPEEDWAY }),
      ).not.toThrow();
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.CLOCKWISE, trackId: TrackId.STRATUS_LOOP }),
      ).not.toThrow();
      expect(() =>
        validateTrackConfig({ trackDirection: TrackDirection.CLOCKWISE, trackId: TrackId.RL_SPEEDWAY }),
      ).not.toThrow();
    });
  });

  describe('validateRacerComputeLimits', () => {
    const testProfileQuotaUsage: ProfileQuotaUsage = {
      computeMinutesQueued: 20,
      computeMinutesUsed: 50,
      maxTotalComputeMinutes: 100,
      modelCount: 4,
      maxModelCount: 10,
    };

    // compute minutes
    it('should not throw error when compute minutes within limits', () => {
      expect(() => validateRacerComputeLimits(testProfileQuotaUsage, 20)).not.toThrow();
    });

    it('should throw error when exceeding max total compute minutes', () => {
      expect(() => validateRacerComputeLimits(testProfileQuotaUsage, 50)).toThrow(BadRequestError);
    });

    it('should throw error when exactly at the limit (boundary case)', () => {
      expect(() => validateRacerComputeLimits(testProfileQuotaUsage, 31)).toThrow(BadRequestError);
    });

    it('should not throw error when just under the limit', () => {
      expect(() => validateRacerComputeLimits(testProfileQuotaUsage, 30)).not.toThrow();
    });

    it('should throw error when maxTotalComputeMinutes is undefined (coerced to 0)', () => {
      expect(() =>
        validateRacerComputeLimits({ ...testProfileQuotaUsage, maxTotalComputeMinutes: undefined }, 50),
      ).toThrow(BadRequestError);
    });

    it('should throw error when maxTotalComputeMinutes is 0 and usage exceeds it', () => {
      expect(() => validateRacerComputeLimits({ ...testProfileQuotaUsage, maxTotalComputeMinutes: 0 }, 50)).toThrow(
        BadRequestError,
      );
    });

    it('should not throw error when maxTotalComputeMinutes is -1 (unlimited)', () => {
      expect(() =>
        validateRacerComputeLimits({ ...testProfileQuotaUsage, maxTotalComputeMinutes: -1 }, 50),
      ).not.toThrow();
    });

    it('should throw error when maxTotalComputeMinutes is -2 (other negative values are enforced)', () => {
      expect(() => validateRacerComputeLimits({ ...testProfileQuotaUsage, maxTotalComputeMinutes: -2 }, 50)).toThrow(
        BadRequestError,
      );
    });

    // model counts
    it('should not throw error when count of models within limits', () => {
      expect(() => validateRacerComputeLimits(testProfileQuotaUsage, 20, true)).not.toThrow();
    });

    it('should throw error when exceeding max count of models', () => {
      expect(() => validateRacerComputeLimits({ ...testProfileQuotaUsage, modelCount: 19 }, 20, true)).toThrow(
        BadRequestError,
      );
    });

    it('should not throw error when max count of models is to be equal to the limit', () => {
      expect(() => validateRacerComputeLimits({ ...testProfileQuotaUsage, modelCount: 9 }, 20, true)).not.toThrow();
    });

    it('should throw error when maxModelCount is undefined (coerced to 0)', () => {
      expect(() =>
        validateRacerComputeLimits({ ...testProfileQuotaUsage, maxModelCount: undefined, modelCount: 0 }, 20, true),
      ).toThrow(BadRequestError);
    });

    it('should throw error when maxModelCount is 0 and adding a model would exceed it', () => {
      expect(() =>
        validateRacerComputeLimits({ ...testProfileQuotaUsage, maxModelCount: 0, modelCount: 0 }, 20, true),
      ).toThrow(BadRequestError);
    });

    it('should not throw error when maxModelCount is -1 (unlimited)', () => {
      expect(() =>
        validateRacerComputeLimits({ ...testProfileQuotaUsage, maxModelCount: -1, modelCount: 19 }, 20, true),
      ).not.toThrow();
    });

    it('should throw error when maxModelCount is -2 (other negative values are enforced)', () => {
      expect(() =>
        validateRacerComputeLimits({ ...testProfileQuotaUsage, maxModelCount: -2, modelCount: 19 }, 20, true),
      ).toThrow(BadRequestError);
    });
  });
});
