// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  TrackId,
  TrackDirection,
  RaceType,
  AgentAlgorithm,
  LossType,
  ExplorationType,
  CameraSensor,
  CarColor,
  CarShell,
  ObjectAvoidanceConfig,
  Hyperparameters,
} from '@deepracer-indy/typescript-client';

import { DEFAULT_OBJECT_POSITIONS } from '#constants/tracks';
import { computeDiscreteActionSpace } from '#pages/CreateModel/components/ActionSpace/components/DiscreteActionSpace/utils';

import { CreateModelFormValues } from './types';

export const BASIC_REWARD_FUNCTION = `def reward_function(params):
    '''
    Example of rewarding the agent to follow center line
    '''

    # Read input parameters
    track_width = params['track_width']
    distance_from_center = params['distance_from_center']

    # Calculate 3 markers that are at varying distances away from the center line
    marker_1 = 0.1 * track_width
    marker_2 = 0.25 * track_width
    marker_3 = 0.5 * track_width

    # Give higher reward if the car is closer to center line and vice versa
    if distance_from_center <= marker_1:
        reward = 1.0
    elif distance_from_center <= marker_2:
        reward = 0.5
    elif distance_from_center <= marker_3:
        reward = 0.1
    else:
        reward = 1e-3  # likely crashed/ close to off track

    return float(reward)`;

export const ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING = `def reward_function(params):
    '''
    Example of rewarding the agent to stay inside the two borders of the track
    '''

    # Read input parameters
    all_wheels_on_track = params['all_wheels_on_track']
    distance_from_center = params['distance_from_center']
    track_width = params['track_width']

    # Give a very low reward by default
    reward = 1e-3

    # Give a high reward if no wheels go off the track and
    # the agent is somewhere in between the track borders
    if all_wheels_on_track and (0.5 * track_width - distance_from_center) >= 0.05:
        reward = 1.0

    # Always return a float value
    return float(reward)`;

export const ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED = `def reward_function(params):
    '''
    Example of penalize steering, which helps mitigate zig-zag behaviors
    '''

    # Read input parameters
    distance_from_center = params['distance_from_center']
    track_width = params['track_width']
    abs_steering = abs(params['steering_angle'])  # Only need the absolute steering angle

    # Calculate 3 marks that are farther and father away from the center line
    marker_1 = 0.1 * track_width
    marker_2 = 0.25 * track_width
    marker_3 = 0.5 * track_width

    # Give higher reward if the car is closer to center line and vice versa
    if distance_from_center <= marker_1:
        reward = 1.0
    elif distance_from_center <= marker_2:
        reward = 0.5
    elif distance_from_center <= marker_3:
        reward = 0.1
    else:
        reward = 1e-3  # likely crashed/ close to off track

    # Steering penality threshold, change the number based on your action space setting
    ABS_STEERING_THRESHOLD = 15

    # Penalize reward if the car is steering too much
    if abs_steering > ABS_STEERING_THRESHOLD:
        reward *= 0.8
    return float(reward)`;

export const OBJECT_AVOIDANCE_REWARD_FUNCTION = `def reward_function(params):
    '''
    Example of rewarding the agent to stay inside two borders
    and penalizing getting too close to the objects in front
    '''

    all_wheels_on_track = params['all_wheels_on_track']
    distance_from_center = params['distance_from_center']
    track_width = params['track_width']
    objects_distance = params['objects_distance']
    _, next_object_index = params['closest_objects']
    objects_left_of_center = params['objects_left_of_center']
    is_left_of_center = params['is_left_of_center']

    # Initialize reward with a small number but not zero
    # because zero means off-track or crashed
    reward = 1e-3

    # Reward if the agent stays inside the two borders of the track
    if all_wheels_on_track and (0.5 * track_width - distance_from_center) >= 0.05:
        reward_lane = 1.0
    else:
        reward_lane = 1e-3

    # Penalize if the agent is too close to the next object
    reward_avoid = 1.0

    # Distance to the next object
    distance_closest_object = objects_distance[next_object_index]
    # Decide if the agent and the next object is on the same lane
    is_same_lane = objects_left_of_center[next_object_index] == is_left_of_center

    if is_same_lane:
        if 0.5 <= distance_closest_object < 0.8:
            reward_avoid *= 0.5
        elif 0.3 <= distance_closest_object < 0.5:
            reward_avoid *= 0.2
        elif distance_closest_object < 0.3:
            reward_avoid = 1e-3  # Likely crashed

    # Calculate reward by putting different weights on
    # the two aspects above
    reward += 1.0 * reward_lane + 4.0 * reward_avoid

    return reward`;

export const DEFAULT_OA_CONFIG: ObjectAvoidanceConfig = {
  numberOfObjects: 3,
  objectPositions: DEFAULT_OBJECT_POSITIONS.slice(0, 3),
};

export const DEFAULT_DISCRETE_ACTION_SPACE = computeDiscreteActionSpace(30, 5, 1, 2);

export const DEFAULT_SAC_HYPERPARAMETERS: Hyperparameters = {
  batch_size: 64,
  discount_factor: 0.99,
  exploration_type: ExplorationType.CATEGORICAL,
  loss_type: LossType.MEAN_SQUARED_ERROR,
  lr: 0.0003,
  num_episodes_between_training: 1,
  sac_alpha: 0.2,
};

export const DEFAULT_PPO_HYPERPARAMETERS: Hyperparameters = {
  batch_size: 64,
  beta_entropy: 0.01,
  discount_factor: 0.99,
  exploration_type: ExplorationType.CATEGORICAL,
  loss_type: LossType.HUBER,
  lr: 0.0003,
  num_episodes_between_training: 20,
  num_epochs: 10,
};

export const initialFormValues: CreateModelFormValues = {
  modelName: '',
  description: '',
  trainingConfig: {
    trackConfig: {
      trackId: TrackId.A_TO_Z_SPEEDWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    },
    maxTimeInMinutes: 10,
    raceType: RaceType.TIME_TRIAL,
    objectAvoidanceConfig: undefined,
  },
  metadata: {
    agentAlgorithm: AgentAlgorithm.PPO,
    rewardFunction: BASIC_REWARD_FUNCTION,
    hyperparameters: DEFAULT_PPO_HYPERPARAMETERS,
    actionSpace: {
      continous: {
        lowSpeed: 1,
        highSpeed: 2,
        lowSteeringAngle: -10,
        highSteeringAngle: 10,
      },
    },
    sensors: {
      camera: CameraSensor.FRONT_FACING_CAMERA,
    },
  },
  actionSpaceForm: {
    steeringAngleGranularity: 5,
    maxSteeringAngle: 30,
    speedGranularity: 2,
    maxSpeed: 1,
    isAdvancedConfigOn: false,
  },
  carCustomization: {
    carColor: CarColor.BLACK,
    carShell: CarShell.DEEPRACER,
  },
};
