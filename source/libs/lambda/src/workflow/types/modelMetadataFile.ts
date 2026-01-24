// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { CameraSensor, LidarSensor } from '@deepracer-indy/typescript-server-client';

import type {
  ActionSpaceType,
  DEEP_CONVOLUTIONAL_NETWORK_SHALLOW,
  SIM_APP_VERSION,
  TrainingAlgorithm,
} from '../constants/simulation.js';

/**
 * ModelMetadataFile format expected by SimApp.
 */
export interface ModelMetadataFile {
  action_space:
    | {
        speed: {
          high: number;
          low: number;
        };
        steering_angle: {
          high: number;
          low: number;
        };
      }
    | { speed: number; steering_angle: number }[];
  action_space_type: ActionSpaceType;
  neural_network: typeof DEEP_CONVOLUTIONAL_NETWORK_SHALLOW;
  sensor: (CameraSensor | LidarSensor)[];
  training_algorithm: (typeof TrainingAlgorithm)[keyof typeof TrainingAlgorithm];
  /** SimApp version */
  version: typeof SIM_APP_VERSION;
}
