// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  RaceType,
  AgentAlgorithm,
  LossType,
  ExplorationType,
  ActionSpace,
  CarColor,
  CarShell,
  TrackId,
  TrackDirection,
  CameraSensor,
  LidarSensor,
} from '@deepracer-indy/typescript-client';
import * as Yup from 'yup';

import {
  RESOURCE_DESCRIPTION_MAX_LENGTH,
  RESOURCE_DESCRIPTION_REGEX,
  RESOURCE_NAME_MAX_LENGTH,
  RESOURCE_NAME_REGEX,
} from '#constants/validation';
import i18n from '#i18n';
import { validateObjectPositions } from '#utils/validationUtils';

import {
  MAX_SPEED_MAX,
  MAX_SPEED_MIN,
  MAX_STEERING_ANGLE_MAX,
  MAX_STEERING_ANGLE_MIN,
} from './components/ActionSpace/constants';
import { CreateModelFormValues } from './types';

interface ValidateOptionsExtended {
  options: {
    index: number;
  };
}

export const createModelValidationSchema: Yup.ObjectSchema<CreateModelFormValues> = Yup.object({
  modelName: Yup.string()
    .required(
      i18n.t('validation:required', { name: i18n.t('createModel:modelInfo.trainingDetailsSection.modelNameLabel') }),
    )
    .matches(
      RESOURCE_NAME_REGEX,
      i18n.t('validation:string.format', {
        name: i18n.t('createModel:modelInfo.trainingDetailsSection.modelNameLabel'),
      }),
    )
    .max(
      RESOURCE_NAME_MAX_LENGTH,
      i18n.t('validation:string.length.max', {
        name: i18n.t('createModel:modelInfo.trainingDetailsSection.modelNameLabel'),
        max: RESOURCE_NAME_MAX_LENGTH,
      }),
    ),
  description: Yup.string()
    .optional()
    .matches(RESOURCE_DESCRIPTION_REGEX, {
      message: i18n.t('validation:string.format', {
        name: i18n.t('createModel:modelInfo.trainingDetailsSection.modelDescription'),
      }),
      excludeEmptyString: true,
    })
    .max(
      RESOURCE_DESCRIPTION_MAX_LENGTH,
      i18n.t('validation:string.length.max', {
        name: i18n.t('createModel:modelInfo.trainingDetailsSection.modelDescription'),
        max: RESOURCE_NAME_MAX_LENGTH,
      }),
    )
    .transform((value) => (value ? value : undefined)),
  trainingConfig: Yup.object({
    trackConfig: Yup.object({
      trackId: Yup.string<TrackId>().oneOf(Object.values(TrackId)).required(),
      trackDirection: Yup.string<TrackDirection>().oneOf(Object.values(TrackDirection)).required(),
    }).required(),
    maxTimeInMinutes: Yup.number()
      .typeError(i18n.t('validation:number.invalid', { name: i18n.t('createModel:stopCondition.maximumTimeLabel') }))
      .min(10, i18n.t('createModel:stopCondition.minimumTimeError'))
      .max(1440, i18n.t('createModel:stopCondition.maximumTimeError'))
      .integer(i18n.t('validation:number.integer', { name: i18n.t('createModel:stopCondition.maximumTimeLabel') }))
      .required(i18n.t('validation:required', { name: i18n.t('createModel:stopCondition.maximumTimeLabel') })),
    raceType: Yup.string<RaceType>().oneOf(Object.values(RaceType)).required(),
    objectAvoidanceConfig: Yup.object({
      numberOfObjects: Yup.number()
        .typeError(
          i18n.t('validation:number.invalid', {
            name: i18n.t('createModel:modelInfo.objectAvoidanceConfig.numberOfObjectsLabel'),
          }),
        )
        .min(1, i18n.t('createModel:modelInfo.objectAvoidanceConfig.minimumNumberOfObjectsError'))
        .max(6, i18n.t('createModel:modelInfo.objectAvoidanceConfig.maximumNumberOfObjectsError'))
        .required(),
      objectPositions: Yup.array()
        .of(
          Yup.object({
            laneNumber: Yup.number()
              .typeError(i18n.t('validation:number.invalid', { name: 'Lane Number' }))
              .required(),
            trackPercentage: Yup.number()
              .typeError(i18n.t('validation:number.invalid', { name: 'Track Percentage' }))
              .min(0.07, i18n.t('createModel:modelInfo.objectAvoidanceConfig.trackPercentageMinError'))
              .max(0.9, i18n.t('createModel:modelInfo.objectAvoidanceConfig.trackPercentageMaxError'))
              .test(
                'validate track percentage distances',
                i18n.t('createModel:modelInfo.objectAvoidanceConfig.trackPercentageGap'),
                (_, context) => {
                  const currentContext = context as Yup.TestContext & ValidateOptionsExtended;
                  const objectPositions = currentContext?.from?.[1]?.value?.objectPositions ?? [];
                  const index = parseInt(currentContext.path.split('[')[1].split(']')[0], 10);
                  return validateObjectPositions(objectPositions, index);
                },
              )
              .required(),
          }),
        )
        .transform((value) => (!value?.length ? undefined : value)),
    })
      .default(undefined)
      .when('raceType', {
        is: RaceType.OBJECT_AVOIDANCE,
        then: (schema) => schema.required(),
        otherwise: (schema) => schema.nullable(),
      }),
  }),
  metadata: Yup.object({
    agentAlgorithm: Yup.string<AgentAlgorithm>().oneOf(Object.values(AgentAlgorithm)).required(),
    rewardFunction: Yup.string()
      .max(
        140000,
        i18n.t('validation:string.length.max', {
          name: i18n.t('createModel:testRewardFunction.rewardFunctionHeader'),
          max: 140000,
        }),
      )
      .required(i18n.t('validation:required', { name: i18n.t('createModel:testRewardFunction.rewardFunctionHeader') })),
    hyperparameters: Yup.object({
      batch_size: Yup.number().required(
        i18n.t('validation:required', { name: i18n.t('createModel:vehicleInfo.gradientDescent') }),
      ),
      num_epochs: Yup.number()
        .typeError(i18n.t('validation:number.invalid', { name: i18n.t('createModel:vehicleInfo.numberOfEpochs') }))
        .integer(i18n.t('validation:number.integer', { name: i18n.t('createModel:vehicleInfo.numberOfEpochs') }))
        .min(3, i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.numberOfEpochs'), min: 3 }))
        .max(10, i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.numberOfEpochs'), max: 10 })),
      stack_size: Yup.number(),
      lr: Yup.number()
        .typeError(i18n.t('validation:number.invalid', { name: i18n.t('createModel:vehicleInfo.learningRate') }))
        .required()
        .min(
          0.00000001,
          i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.learningRate'), min: 0.00000001 }),
        )
        .max(
          0.001,
          i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.learningRate'), max: 0.001 }),
        ),
      beta_entropy: Yup.number()
        .typeError(i18n.t('validation:number.invalid', { name: i18n.t('createModel:vehicleInfo.entropy') }))
        .min(0, i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.entropy'), min: 0 }))
        .max(1, i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.entropy'), max: 1 })),
      e_greedy_value: Yup.number(),
      epsilon_steps: Yup.number(),
      discount_factor: Yup.number()
        .typeError(i18n.t('validation:number.invalid', { name: i18n.t('createModel:vehicleInfo.discountFactor') }))
        .min(0, i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.discountFactor'), min: 0 }))
        .max(1, i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.discountFactor'), max: 1 }))
        .required(),
      loss_type: Yup.string<LossType>().oneOf(Object.values(LossType)).required(),
      num_episodes_between_training: Yup.number()
        .typeError(i18n.t('validation:number.invalid', { name: 'Number of experience episodes' }))
        .integer(i18n.t('validation:number.integer', { name: 'Number of experience episodes' }))
        .required()
        .when((_val, schema, options) => {
          const agentAlgorithm = (options as Yup.TestOptions['options']).from?.[1].value.agentAlgorithm;

          if (agentAlgorithm === AgentAlgorithm.PPO) {
            return schema
              .min(
                5,
                i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.numberOfEpisodes'), min: 5 }),
              )
              .max(
                100,
                i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.numberOfEpisodes'), max: 100 }),
              );
          } else {
            return schema
              .min(
                1,
                i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.numberOfEpisodes'), min: 1 }),
              )
              .max(
                1,
                i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.numberOfEpisodes'), max: 1 }),
              );
          }
        }),
      exploration_type: Yup.string<ExplorationType>().oneOf(Object.values(ExplorationType)).required(),
      sac_alpha: Yup.number()
        .typeError(i18n.t('validation:number.invalid', { name: i18n.t('createModel:vehicleInfo.sacAlpha') }))
        .min(0, i18n.t('validation:number.min', { name: i18n.t('createModel:vehicleInfo.sacAlpha'), min: 0 }))
        .max(1, i18n.t('validation:number.max', { name: i18n.t('createModel:vehicleInfo.sacAlpha'), max: 1 })),
    }).required(),
    actionSpace: Yup.mixed<ActionSpace.ContinousMember | ActionSpace.DiscreteMember>()
      .when({
        is: (value: ActionSpace.ContinousMember | ActionSpace.DiscreteMember): value is ActionSpace.ContinousMember =>
          !!value.continous,
        then: () =>
          Yup.object({
            continous: Yup.object({
              lowSpeed: Yup.number()
                .typeError(
                  i18n.t('validation:number.invalid', {
                    name: i18n.t('createModel:actionSpace.continuousSection.minimumSpeed'),
                  }),
                )
                .required(i18n.t('createModel:requiredError'))
                .min(
                  0.1,
                  i18n.t('validation:number.min', {
                    name: i18n.t('createModel:actionSpace.continuousSection.minimumSpeed'),
                    min: 0.1,
                  }),
                )
                .max(
                  4,
                  i18n.t('validation:number.max', {
                    name: i18n.t('createModel:actionSpace.continuousSection.minimumSpeed'),
                    max: 4,
                  }),
                )
                .test(
                  'lowSpeedLessThanHighSpeed',
                  i18n.t('validation:number.lessThanField', {
                    name: i18n.t('createModel:actionSpace.continuousSection.minimumSpeed'),
                    lessThanName: i18n.t('createModel:actionSpace.continuousSection.maximumSpeed'),
                  }),
                  (lowSpeed, { parent }) => {
                    const { highSpeed } = parent;
                    return lowSpeed < highSpeed;
                  },
                ),
              highSpeed: Yup.number()
                .typeError(
                  i18n.t('validation:number.invalid', {
                    name: i18n.t('createModel:actionSpace.continuousSection.maximumSpeed'),
                  }),
                )
                .required(i18n.t('createModel:requiredError'))
                .min(
                  0.1,
                  i18n.t('validation:number.min', {
                    name: i18n.t('createModel:actionSpace.continuousSection.maximumSpeed'),
                    min: 0.1,
                  }),
                )
                .max(
                  4,
                  i18n.t('validation:number.max', {
                    name: i18n.t('createModel:actionSpace.continuousSection.maximumSpeed'),
                    max: 4,
                  }),
                )
                .test(
                  'highSpeedGreaterThanLowSpeed',
                  i18n.t('validation:number.greaterThanField', {
                    name: i18n.t('createModel:actionSpace.continuousSection.maximumSpeed'),
                    greaterThanName: i18n.t('createModel:actionSpace.continuousSection.minimumSpeed'),
                  }),
                  (highSpeed, { parent }) => {
                    const { lowSpeed } = parent;
                    return highSpeed > lowSpeed;
                  },
                ),
              lowSteeringAngle: Yup.number()
                .typeError(
                  i18n.t('validation:number.invalid', {
                    name: i18n.t('createModel:actionSpace.continuousSection.rightSteeringAngle'),
                  }),
                )
                .required(i18n.t('createModel:requiredError'))
                .min(
                  -30,
                  i18n.t('validation:number.min', {
                    name: i18n.t('createModel:actionSpace.continuousSection.rightSteeringAngle'),
                    min: -30,
                  }),
                )
                .max(
                  0,
                  i18n.t('validation:number.max', {
                    name: i18n.t('createModel:actionSpace.continuousSection.rightSteeringAngle'),
                    max: 0,
                  }),
                )
                .test(
                  'lowSteeringAngleLessThanHighSteeringAngle',
                  i18n.t('validation:number.lessThanField', {
                    name: i18n.t('createModel:actionSpace.continuousSection.rightSteeringAngle'),
                    lessThanName: i18n.t('createModel:actionSpace.continuousSection.leftSteeringAngle'),
                  }),
                  (lowSteeringAngle, { parent }) => {
                    const { highSteeringAngle } = parent;
                    return lowSteeringAngle < highSteeringAngle;
                  },
                ),
              highSteeringAngle: Yup.number()
                .typeError(
                  i18n.t('validation:number.invalid', {
                    name: i18n.t('createModel:actionSpace.continuousSection.leftSteeringAngle'),
                  }),
                )
                .required(i18n.t('createModel:requiredError'))
                .min(
                  0,
                  i18n.t('validation:number.min', {
                    name: i18n.t('createModel:actionSpace.continuousSection.leftSteeringAngle'),
                    min: 0,
                  }),
                )
                .max(
                  30,
                  i18n.t('validation:number.max', {
                    name: i18n.t('createModel:actionSpace.continuousSection.leftSteeringAngle'),
                    max: 30,
                  }),
                )
                .test(
                  'highSteeringAngleGreaterThanLowSteeringAngle',
                  i18n.t('validation:number.greaterThanField', {
                    name: i18n.t('createModel:actionSpace.continuousSection.leftSteeringAngle'),
                    greaterThanName: i18n.t('createModel:actionSpace.continuousSection.rightSteeringAngle'),
                  }),
                  (highSteeringAngle, { parent }) => {
                    const { lowSteeringAngle } = parent;
                    return highSteeringAngle > lowSteeringAngle;
                  },
                ),
            }),
          }),
        otherwise: () =>
          Yup.object({
            discrete: Yup.array().of(
              Yup.object({
                speed: Yup.number()
                  .typeError(i18n.t('validation:number.invalid', { name: 'Speed' }))
                  .min(0.1)
                  .max(4)
                  .required(),
                steeringAngle: Yup.number()
                  .typeError(i18n.t('validation:number.invalid', { name: 'Steering Angle' }))
                  .min(-30)
                  .max(30)
                  .required(),
              }),
            ),
          }),
      })
      .required(i18n.t('createModel:requiredError')),
    sensors: Yup.object({
      camera: Yup.string<CameraSensor>().oneOf(Object.values(CameraSensor)),
      lidar: Yup.string<LidarSensor>().oneOf(Object.values(LidarSensor)),
    }).required(i18n.t('createModel:requiredError')),
  }),
  actionSpaceForm: Yup.object({
    steeringAngleGranularity: Yup.number()
      .typeError(
        i18n.t('validation:number.invalid', {
          name: i18n.t('createModel:actionSpace.discreteSection.steeringAngleGranularity'),
        }),
      )
      .integer(
        i18n.t('validation:number.integer', {
          name: i18n.t('createModel:actionSpace.discreteSection.steeringAngleGranularity'),
        }),
      )
      .required(),
    maxSteeringAngle: Yup.number()
      .typeError(
        i18n.t('validation:number.invalid', {
          name: i18n.t('createModel:actionSpace.discreteSection.maxSteeringAngle'),
        }),
      )
      .required()
      .min(
        MAX_STEERING_ANGLE_MIN,
        i18n.t('validation:number.min', {
          name: i18n.t('createModel:actionSpace.discreteSection.maxSteeringAngle'),
          min: MAX_STEERING_ANGLE_MIN,
        }),
      )
      .max(
        MAX_STEERING_ANGLE_MAX,
        i18n.t('validation:number.max', {
          name: i18n.t('createModel:actionSpace.discreteSection.maxSteeringAngle'),
          max: MAX_STEERING_ANGLE_MAX,
        }),
      ),
    speedGranularity: Yup.number()
      .typeError(
        i18n.t('validation:number.invalid', {
          name: i18n.t('createModel:actionSpace.discreteSection.speedGranularity'),
        }),
      )
      .integer(
        i18n.t('validation:number.integer', {
          name: i18n.t('createModel:actionSpace.discreteSection.speedGranularity'),
        }),
      )
      .required(),
    maxSpeed: Yup.number()
      .typeError(
        i18n.t('validation:number.invalid', { name: i18n.t('createModel:actionSpace.discreteSection.maxSpeed') }),
      )
      .required()
      .min(
        MAX_SPEED_MIN,
        i18n.t('validation:number.min', {
          name: i18n.t('createModel:actionSpace.discreteSection.maxSpeed'),
          min: MAX_SPEED_MIN,
        }),
      )
      .max(
        MAX_SPEED_MAX,
        i18n.t('validation:number.max', {
          name: i18n.t('createModel:actionSpace.discreteSection.maxSpeed'),
          max: MAX_SPEED_MAX,
        }),
      ),
    isAdvancedConfigOn: Yup.boolean().required(),
  }),
  carCustomization: Yup.object({
    carColor: Yup.mixed<CarColor>().oneOf(Object.values(CarColor)).required(i18n.t('createModel:requiredError')),
    carShell: Yup.mixed<CarShell>().oneOf(Object.values(CarShell)).required(i18n.t('createModel:requiredError')),
  }),
  preTrainedModelId: Yup.string().optional(),
});
