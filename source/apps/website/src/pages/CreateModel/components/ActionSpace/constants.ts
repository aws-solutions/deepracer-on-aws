// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const CONTINUOUS_STEERING_LOW_MIN = -30;
export const CONTINUOUS_STEERING_LOW_MAX = 0;
export const CONTINUOUS_STEERING_HIGH_MIN = 0;
export const CONTINUOUS_STEERING_HIGH_MAX = 30;
export const CUSTOM_CONTINUOUS_SPEED_MIN = 0.1;
export const CONTINUOUS_SPEED_MAX = 4.0;
export const MAX_ACTIONS_PER_PAGE = 30;
export const MAX_ACTIONS = 30;
export const MAX_STEERING_ANGLE_MAX = 30;
export const MAX_STEERING_ANGLE_MIN = 1;
export const MAX_SPEED_MAX = 4.0;
export const MAX_SPEED_MIN = 0.1;
export const MIN_STEERING = -30;
export const MIN_ACTIONS = 2;
export const MAX_ANGLE_ARROW_ID = 'max_angle_arrow';
export const MIN_ANGLE_ARROW_ID = 'min_angle_arrow';
export const GRAPH_PRIMARY = '#779EFF';
export const GRAPH_BLACK = '#16191F';

export enum CoordinateType {
  X = 'X',
  Y = 'Y',
}

export enum DiscreteActionValueType {
  STEERING_ANGLE = 'angle',
  SPEED = 'speed',
}

export enum ActionSpaceType {
  CONTINUOUS = 'ContinousActionSpace',
  DISCRETE = 'DiscreteActionSpace',
}
