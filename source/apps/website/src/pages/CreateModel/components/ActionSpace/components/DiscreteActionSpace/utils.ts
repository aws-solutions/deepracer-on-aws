// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { IndexedDiscreteActionSpaceItem } from './types';

// The goal of this function is to compute the list of available actions that the agent
// can take based on the input parameters specified by the user. An action is a pair of
// values (steering in degrees, speed in m/s) which produce control signals to the car
// in both the simulator and real world, and the trained policy network is what selects
// which action the car should take at any given time step. Valid values for steering
// and speed are computed using numSteeringLevels evenly spaced samples in the interval
// [-maxSteering, +maxSteering] and numSpeedLevels evenly spaced samples in the interval
// [maxSpeed/numSpeedLevels, maxSpeed], respectively. The full action space is all
// combinations of valid steering values and valid speed values.
export const computeDiscreteActionSpace = (
  maxSteering: number,
  numSteeringLevels: number,
  maxSpeed: number,
  numSpeedLevels: number,
) => {
  const discreteActionSpace: IndexedDiscreteActionSpaceItem[] = [];

  for (let iSteering = 0; iSteering < numSteeringLevels; iSteering += 1) {
    const tSteering = numSteeringLevels < 2 ? 0.0 : iSteering / (numSteeringLevels - 1);
    for (let iSpeed = 1; iSpeed <= numSpeedLevels; iSpeed += 1) {
      const tSpeed = numSpeedLevels < 2 ? 1.0 : iSpeed / numSpeedLevels;
      discreteActionSpace.push({
        index: discreteActionSpace.length,
        steeringAngle: -maxSteering * (1.0 - tSteering) + maxSteering * tSteering,
        speed: maxSpeed * tSpeed,
      });
    }
  }

  return discreteActionSpace;
};
