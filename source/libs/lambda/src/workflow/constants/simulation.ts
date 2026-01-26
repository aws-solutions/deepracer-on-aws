// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobType } from '@deepracer-indy/database';
import { AgentAlgorithm, CarColor, CarShell } from '@deepracer-indy/typescript-server-client';

export enum ActionSpaceType {
  CONTINUOUS = 'continuous',
  DISCRETE = 'discrete',
}

export const DEEP_CONVOLUTIONAL_NETWORK_SHALLOW = 'DEEP_CONVOLUTIONAL_NETWORK_SHALLOW';

export const SimulationLaunchFile = {
  [JobType.EVALUATION]: 'evaluation.launch.py',
  [JobType.SUBMISSION]: 'evaluation.launch.py',
  [JobType.TRAINING]: 'distributed_training.launch.py',
} as const;

export const SIM_APP_VERSION = 6;

export const TrainingAlgorithm = {
  [AgentAlgorithm.PPO]: 'clipped_ppo',
  [AgentAlgorithm.SAC]: 'sac',
} as const;

export enum SimulationJobStatus {
  INITIALIZING = 'INITIALIZING',
  RUNNING = 'RUNNING',
  FAILED = 'FAILED',
  CLOSED = 'CLOSED',
}

export const TRAINING_TRAINING_LOG_GROUP = '/aws/deepracer/training/TrainingJobs';
export const TRAINING_SIMULATION_LOG_GROUP = '/aws/deepracer/training/SimulationJobs';
export const EVALUATION_SIMULATION_LOG_GROUP = '/aws/sagemaker/TrainingJobs';

export const DEEPRACER_CAR_SHELL_ID = 'deepracer';
export const DEFAULT_DEEPRACER_CAR_SHELL_COLOR = 'Black';

/**
 * Mapping of available CarShell + CarColor combinations to SimApp carShellId.
 */
export const SimAppCarShells: { [Car in CarShell]: { [Color in CarColor]?: string } } = {
  [CarShell.AGATHA]: {
    [CarColor.GREY]: 'f1_car_mercedes_08',
  },
  [CarShell.AMAZON_EDV]: {
    [CarColor.PURPLE]: 'f1_amazon_van_purple_with_wheel',
    [CarColor.WHITE]: 'f1_amazon_van_white_with_wheel',
  },
  [CarShell.BAJA_TRUCK]: {
    [CarColor.TEAL]: 'f1_baja_truck_05',
    [CarColor.ORANGE]: 'f1_baja_truck_03',
  },
  [CarShell.BANANA]: {
    [CarColor.BLACK]: 'f1_car_banana_01',
  },
  [CarShell.BIKE]: {
    [CarColor.BLUE]: 'f1_august_bike_02_with_wheel',
    [CarColor.RED]: 'f1_august_bike_01_with_wheel',
  },
  [CarShell.BUGGY]: {
    [CarColor.WHITE]: 'f1_september_bug_01_with_wheel',
    [CarColor.PURPLE]: 'f1_september_bug_02_with_wheel',
  },
  [CarShell.CLOWN]: {
    [CarColor.YELLOW]: 'f1_car_clown_01',
  },
  [CarShell.COMPACT]: {
    [CarColor.RED]: 'f1_june_car_01',
    [CarColor.PURPLE]: 'f1_june_car_02',
  },
  [CarShell.DEEPRACER]: {
    [CarColor.BLACK]: 'deepracer',
    [CarColor.BLUE]: 'deepracer',
    [CarColor.GREY]: 'deepracer',
    [CarColor.ORANGE]: 'deepracer',
    [CarColor.PURPLE]: 'deepracer',
    [CarColor.RED]: 'deepracer',
    [CarColor.WHITE]: 'deepracer',
  },
  [CarShell.DOG_VAN]: {
    [CarColor.BROWN]: 'f1_dog_van',
  },
  [CarShell.DRAGON]: {
    [CarColor.BROWN]: 'f1_dragon',
  },
  [CarShell.DUNE_BUGGY]: {
    [CarColor.RED]: 'f1_dune_buggy_01',
    [CarColor.GOLDEN]: 'f1_dune_buggy_07',
  },
  [CarShell.F1]: {
    [CarColor.RED]: 'f1_2021',
  },
  [CarShell.F1_NUDIE]: {
    [CarColor.PURPLE]: 'f1_nudie_purple_with_wheel',
    [CarColor.ORANGE]: 'f1_nudie_orange_with_wheel',
    [CarColor.WHITE]: 'f1_nudie_white_with_wheel',
  },
  [CarShell.FAMILY_WAGON]: {
    [CarColor.GREEN]: 'f1_october_wagon_01_with_wheel',
    [CarColor.PURPLE]: 'f1_october_wagon_02_with_wheel',
  },
  [CarShell.GT]: {
    [CarColor.PURPLE]: 'f1_december_car_01_with_wheel',
    [CarColor.RED]: 'f1_december_car_02_with_wheel',
  },
  [CarShell.HOT_ROD]: {
    [CarColor.PURPLE]: 'f1_hotrod_03',
    [CarColor.ORANGE]: 'fl_hotrod_02',
  },
  [CarShell.KART]: {
    [CarColor.RED]: 'f1_kart',
  },
  [CarShell.LORRY]: {
    [CarColor.PURPLE]: 'f1_lorry_01',
  },
  [CarShell.LUNAR_ROVER]: {
    [CarColor.BROWN]: 'f1_lunar_rover',
    [CarColor.GOLDEN]: 'f1_july_car_03_with_wheel',
  },
  [CarShell.MARS_ROVER]: {
    [CarColor.WHITE]: 'f1_mars_rover_with_wheel',
  },
  [CarShell.MONSTER_TRUCK]: {
    [CarColor.PURPLE]: 'f1_monster_truck_01',
  },
  [CarShell.NELL]: {
    [CarColor.RED]: 'f1_mustang_eleanor_01',
    [CarColor.BLACK]: 'f1_mustang_eleanor_02',
    [CarColor.YELLOW]: 'f1_mustang_eleanor_03',
  },
  [CarShell.RETRO_FUTURISTIC]: {
    [CarColor.PURPLE]: 'f1_car_retro_01',
  },
  [CarShell.ROGUE_ROD]: {
    [CarColor.ORANGE]: 'f1_rogue_01',
  },
  [CarShell.SNAIL]: {
    [CarColor.PINK]: 'f1_snail',
  },
  [CarShell.TRON]: {
    [CarColor.BLUE]: 'f1_car_tron_01',
    [CarColor.RED]: 'f1_car_tron_02',
    [CarColor.GOLDEN]: 'f1_car_tron_03',
    [CarColor.WHITE]: 'f1_car_tron_04',
    [CarColor.SKY_BLUE]: 'f1_car_tron_05',
    [CarColor.GREEN]: 'f1_car_tron_06',
    [CarColor.PURPLE]: 'f1_car_tron_07',
    [CarColor.YELLOW]: 'f1_car_tron_08',
    [CarColor.GREY]: 'f1_car_tron_09',
    [CarColor.GOLDENPINK]: 'f1_car_tron_10',
  },
  [CarShell.WAGON]: {
    [CarColor.PINK]: 'f1_july_car_01_with_wheel',
    [CarColor.BLUE]: 'f1_july_car_02_with_wheel',
  },
};

export const VALID_DEEPRACER_SHELL_COLORS = Object.keys(SimAppCarShells[CarShell.DEEPRACER]);
