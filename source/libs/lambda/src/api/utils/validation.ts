// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  BadRequestError,
  CarCustomization,
  ContinuousActionSpace,
  ObjectAvoidanceConfig,
  TrackConfig,
} from '@deepracer-indy/typescript-server-client';

import { ProfileQuotaUsage } from '../../utils/UsageQuotaHelper.js';
import { SimAppCarShells } from '../../workflow/constants/simulation.js';
import { TRACKS } from '../constants/tracks.js';

const FIRST_OBSTACLE_BUFFER = 0.07;
const LAST_OBSTACLE_BUFFER = 0.9;
const MIN_OBSTACLE_DISTANCE = 0.13;
const MIN_WORKFLOW_TIME_IN_MINUTES = 10;
const MAX_TRAINING_TIME_IN_MINUTES = 1440;

export const validateTerminationConditions = (maxTimeInMinutes: number) => {
  if (maxTimeInMinutes < MIN_WORKFLOW_TIME_IN_MINUTES || maxTimeInMinutes > MAX_TRAINING_TIME_IN_MINUTES) {
    throw new BadRequestError({ message: 'Max time in minutes is invalid.' });
  }
};

export const validateObjectAvoidanceConfig = (config: ObjectAvoidanceConfig | undefined) => {
  if (!config?.numberOfObjects || config.numberOfObjects > 6) {
    throw new BadRequestError({ message: 'Number of obstacle positions is invalid.' });
  } else if (config?.objectPositions?.length && config.numberOfObjects !== config?.objectPositions.length) {
    throw new BadRequestError({ message: 'Obstacle positions must be equal to number of objects.' });
  }

  if (config?.objectPositions?.length) {
    const sortedObstaclePositions = config.objectPositions.sort((a, b) => a.trackPercentage - b.trackPercentage);

    if (sortedObstaclePositions.length && sortedObstaclePositions[0].trackPercentage < FIRST_OBSTACLE_BUFFER) {
      throw new BadRequestError({ message: 'First obstacle position is invalid.' });
    } else if (
      sortedObstaclePositions.length &&
      sortedObstaclePositions[sortedObstaclePositions.length - 1].trackPercentage > LAST_OBSTACLE_BUFFER
    ) {
      throw new BadRequestError({ message: 'Last obstacle position is invalid.' });
    }

    for (let i = 0; i < sortedObstaclePositions.length - 1; i++) {
      const distance = sortedObstaclePositions[i + 1].trackPercentage - sortedObstaclePositions[i].trackPercentage;

      if (distance < MIN_OBSTACLE_DISTANCE) {
        throw new BadRequestError({ message: 'Obstacle position distances are invalid.' });
      }
    }
  }
};

export const validateContinuousActionSpace = (actionSpace: ContinuousActionSpace) => {
  if (actionSpace.lowSpeed >= actionSpace.highSpeed) {
    throw new BadRequestError({ message: 'Invalid action space speeds.' });
  }
  if (actionSpace.lowSteeringAngle >= actionSpace.highSteeringAngle) {
    throw new BadRequestError({ message: 'Invalid action space steering angles.' });
  }
};

export const validateCarCustomization = (carCustomization: CarCustomization) => {
  const { carColor, carShell } = carCustomization;

  const isValid = !!SimAppCarShells[carShell][carColor];

  if (!isValid) {
    throw new BadRequestError({
      message: `Invalid car customization. Car shell ${carShell} is not available in color ${carColor}.`,
    });
  }
};

export const validateTrackConfig = (trackConfig: TrackConfig) => {
  const { trackDirection, trackId } = trackConfig;

  const isValid = TRACKS.find((track) => track.trackId === trackId)?.enabledDirections.includes(trackDirection);

  if (!isValid) {
    throw new BadRequestError({
      message: `Invalid track configuration. Track ${trackId} is not available in direction ${trackDirection}.`,
    });
  }
};

/**
 * validates compute minutes and model count limits and throws BadRequestError if exceeded
 * @param profileQuotaUsage
 * @param requestedMinutes
 * @param checkModelCount default false, set it to true to check model counts too
 */
export const validateRacerComputeLimits = (
  profileQuotaUsage: ProfileQuotaUsage,
  requestedMinutes: number,
  checkModelCount = false,
) => {
  if (
    profileQuotaUsage.maxTotalComputeMinutes !== -1 &&
    (profileQuotaUsage.maxTotalComputeMinutes || 0) <
      profileQuotaUsage.computeMinutesUsed + profileQuotaUsage.computeMinutesQueued + requestedMinutes
  ) {
    throw new BadRequestError({ message: 'Total compute minutes for the month exceeded.' });
  }
  if (
    checkModelCount &&
    profileQuotaUsage.maxModelCount !== -1 &&
    (profileQuotaUsage.maxModelCount || 0) < profileQuotaUsage.modelCount + 1
  ) {
    throw new BadRequestError({ message: 'Total number of models for the month exceeded.' });
  }
};
