// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RaceType, TrackConfig, TimingMethod } from '@deepracer-indy/typescript-client';
import * as Yup from 'yup';

import {
  RESOURCE_NAME_MAX_LENGTH,
  RESOURCE_NAME_REGEX,
  RESOURCE_DESCRIPTION_MAX_LENGTH,
  RESOURCE_DESCRIPTION_REGEX,
} from '../../constants/validation.js';
import i18n from '../../i18n/index.js';
import { validateObjectPositions } from '../../utils/validationUtils.js';

export const validateStartTime: Yup.TestFunction<string> = function (startTime, ctx) {
  const { startDate } = this.parent;

  if (!startDate) return true;

  const [year, month, day] = startDate.split('-').map(Number);
  const [hours, minutes] = startTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, hours, minutes);
  const now = new Date();

  if (start <= now) {
    return ctx.createError({ message: i18n.t('createRace:addRaceDetails.validationErrors.startTimeInPast') });
  }

  return true;
};

/**
 * Validates that the start date is not in the past.
 */
export const validateStartDate: Yup.TestFunction<string> = function (startDate, ctx) {
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const today = new Date();

  // Reset time to start of day for accurate date comparison
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return ctx.createError({ message: i18n.t('createRace:addRaceDetails.validationErrors.startDateInPast') });
  }

  return true;
};

/**
 * Validates that the end date is after the start date.
 */
export const validateEndDate: Yup.TestFunction<string> = function (endDate, ctx) {
  const { startDate } = this.parent;

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);

  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const end = new Date(endYear, endMonth - 1, endDay);

  // Reset time to start of day for accurate date comparison
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < start) {
    return ctx.createError({ message: i18n.t('createRace:addRaceDetails.validationErrors.endDateBeforeStartDate') });
  }

  return true;
};

/**
 * Validates that the end date/time is after the start date/time.
 */
export const validateEndTime: Yup.TestFunction<string> = function (endTime, ctx) {
  const { startDate, startTime, endDate } = this.parent;

  if (!startDate || !startTime || !endDate) return true;

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay, startHours, startMinutes);

  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  const end = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes);

  if (end <= start) {
    return ctx.createError({ message: i18n.t('createRace:addRaceDetails.validationErrors.endTimeBeforeStartTime') });
  }

  return true;
};

export const createRaceValidationSchema = Yup.object().shape({
  raceName: Yup.string()
    .required(i18n.t('createRace:required'))
    .max(RESOURCE_NAME_MAX_LENGTH, i18n.t('createRace:addRaceDetails.errorNameMaxLength'))
    .matches(RESOURCE_NAME_REGEX, i18n.t('createRace:addRaceDetails.nameOfRacingEventNoMatch')),
  startDate: Yup.string().required(i18n.t('createRace:required')).test(validateStartDate),
  startTime: Yup.string().required(i18n.t('createRace:required')).test(validateStartTime),
  endDate: Yup.string().required(i18n.t('createRace:required')).test(validateEndDate),
  endTime: Yup.string().required(i18n.t('createRace:required')).test(validateEndTime),
  raceType: Yup.mixed<RaceType>().required(i18n.t('createRace:required')),
  track: Yup.mixed<TrackConfig>().required(i18n.t('createRace:required')),
  desc: Yup.string()
    .optional()
    .max(RESOURCE_DESCRIPTION_MAX_LENGTH)
    .matches(RESOURCE_DESCRIPTION_REGEX, {
      excludeEmptyString: true,
      message: i18n.t('createRace:addRaceDetails.errorDescriptionNoMatch'),
    }),
  ranking: Yup.mixed<TimingMethod>().required(i18n.t('createRace:required')),
  minLap: Yup.string().required(i18n.t('createRace:required')),
  offTrackPenalty: Yup.string().required(i18n.t('createRace:required')),
  collisionPenalty: Yup.string().required(i18n.t('createRace:required')),
  maxSubmissionsPerUser: Yup.number().required(i18n.t('createRace:required')),
  objectAvoidanceConfig: Yup.object()
    .required()
    .shape({
      numberOfObjects: Yup.number()
        .min(1, i18n.t('createModel:modelInfo.objectAvoidanceConfig.minimumNumberOfObjectsError'))
        .max(5, i18n.t('createModel:modelInfo.objectAvoidanceConfig.maximumNumberOfObjectsError'))
        .required(i18n.t('createRace:required')),
      objectPositions: Yup.array().of(
        Yup.object().shape({
          laneNumber: Yup.number().required(i18n.t('createRace:required')),
          trackPercentage: Yup.number()
            .max(0.9, i18n.t('createRace:addRaceDetails.percentConstraint'))
            .min(0.07, i18n.t('createRace:addRaceDetails.percentConstraint'))
            .required(i18n.t('createRace:required'))
            .test(
              'is-object-positions-valid',
              i18n.t('createRace:addRaceDetails.obstacleDistanceError'),
              function (_, context) {
                const objectPositions = context?.from?.[1]?.value?.objectPositions ?? [];
                const index = parseInt(this.path.split('[')[1].split(']')[0], 10);
                return validateObjectPositions(objectPositions, index);
              },
            ),
        }),
      ),
    }),
  randomizeObstacles: Yup.boolean().required(i18n.t('createRace:required')),
});
