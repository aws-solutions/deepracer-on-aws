// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CombinedScoringStrategy, EventType, RaceFormat, TrackId } from '@deepracer-indy/typescript-client';
import * as Yup from 'yup';

import i18n from '#i18n/index.js';

export interface CreateEventFormValues {
  name: string;
  eventType: EventType | '';
  eventDate: string;
  countryCode: string;
  sponsor: string;
  raceFormat: RaceFormat | '';
  combinedScoringStrategy: CombinedScoringStrategy | '';
  /** Header text shown above the combined leaderboard (multi-track events). */
  combinedLeaderBoardHeader: string;
  /** Footer text shown beneath the combined leaderboard (multi-track events). */
  combinedLeaderBoardFooter: string;
  maxLaps: number;
  /** Select value; mirrors DREM's RaceTimeConfig (raceConfigPanel.tsx) — fixed 1-10 minutes. */
  maxTimeInMinutes: string;
  /** Select value; '' represents "Unlimited" (see MAX_RUNS_PER_RACER_OPTION_VALUES). */
  maxRunsPerRacer: string;
  /** Select value; '9999' represents "Unlimited" (see MAX_RESETS_OPTION_VALUES). */
  maxResets: string;
  /**
   * Select value; only meaningful (and sent to the API) when raceFormat is AVERAGE_LAPS —
   * see MAX_LAPS_WINDOW_OPTION_VALUES. Mirrors DREM's AverageLapWindowConfig.
   */
  averageLapsWindow: string;
  /**
   * Track layout applied to every track added to this event (mirrors DREM's single
   * event-wide raceConfig.trackType Select — see raceConfigPanel.tsx). Not persisted on
   * the Event itself; passed down to EventTracks/CreateEventTracks as the layout used
   * for AddTrackToEvent calls (Leaderboard/AddTrackToEvent still store trackType
   * per-track, preserving a future per-track override without a migration).
   */
  trackType: TrackId | '';
}

/** Mirrors DREM's MaxRunsPerRacerConfig (raceConfigPanel.tsx) — '' selects "Unlimited". */
export const MAX_RUNS_PER_RACER_OPTION_VALUES = ['', '5', '4', '3', '2', '1'] as const;

/** Mirrors DREM's RaceTimeConfig (raceConfigPanel.tsx) — fixed 1-10 minutes, no "Unlimited" option. */
export const MAX_TIME_IN_MINUTES_OPTION_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

/**
 * Mirrors DREM's ResetConfig (raceConfigPanel.tsx) — '9999' selects "Unlimited". Unlike
 * maxRunsPerRacer, maxResets is @required end-to-end (Smithy + ElectroDB), so "Unlimited"
 * is expressed as DREM's literal sentinel value rather than an absent field.
 */
export const MAX_RESETS_UNLIMITED_SENTINEL = '9999';
export const MAX_RESETS_OPTION_VALUES = [
  MAX_RESETS_UNLIMITED_SENTINEL,
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
  '1',
  '0',
] as const;

/** Mirrors DREM's AverageLapWindowConfig (raceConfigPanel.tsx) — fixed 3-7, no "Unlimited" option. */
export const AVERAGE_LAPS_WINDOW_OPTION_VALUES = ['3', '4', '5', '6', '7'] as const;

export const CREATE_EVENT_DEFAULTS: CreateEventFormValues = {
  name: '',
  eventType: '',
  eventDate: '',
  countryCode: '',
  sponsor: '',
  raceFormat: '',
  combinedScoringStrategy: '',
  combinedLeaderBoardHeader: '',
  combinedLeaderBoardFooter: '',
  maxLaps: 5,
  maxTimeInMinutes: '3',
  maxRunsPerRacer: '3',
  maxResets: MAX_RESETS_UNLIMITED_SENTINEL,
  averageLapsWindow: '3',
  trackType: '',
};

/**
 * Validates that the event date is today or in the future. Only enforced when creating an
 * event — in edit mode, an already-past event's date must remain editable (e.g. to fix
 * other fields) without being blocked by a date that's no longer in the future.
 */
export const validateEventDate: Yup.TestFunction<string> = function (eventDate, ctx) {
  const [year, month, day] = eventDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return ctx.createError({ message: i18n.t('events:form.validation.eventDatePast') });
  }
  return true;
};

export const createEventValidationSchema = (isEditMode: boolean, trackCount = 0) =>
  Yup.object({
    name: Yup.string()
      .required(() => i18n.t('events:form.validation.nameRequired'))
      .max(128),
    eventType: Yup.string().required(() => i18n.t('events:form.validation.eventTypeRequired')),
    eventDate: Yup.string()
      .required(() => i18n.t('events:form.validation.eventDateRequired'))
      .matches(/^\d{4}-\d{2}-\d{2}$/, () => i18n.t('events:form.validation.eventDateFormat'))
      .when([], {
        is: () => !isEditMode,
        then: (schema) => schema.test(validateEventDate),
      }),
    countryCode: Yup.string()
      .required(() => i18n.t('events:form.validation.countryRequired'))
      .matches(/^[A-Z]{2}$/, () => i18n.t('events:form.validation.countryLength')),
    sponsor: Yup.string().max(128),
    raceFormat: Yup.string().required(() => i18n.t('events:form.validation.raceFormatRequired')),
    combinedScoringStrategy: Yup.string().test(
      'combined-scoring-required-for-multi-track',
      () => i18n.t('events:form.validation.combinedScoringStrategyRequired'),
      (value) => trackCount < 2 || Boolean(value),
    ),
    combinedLeaderBoardHeader: Yup.string().max(128),
    combinedLeaderBoardFooter: Yup.string().max(255),
    maxLaps: Yup.number()
      .required(() => i18n.t('events:form.validation.maxLapsRequired'))
      .integer()
      .min(1, () => i18n.t('events:form.validation.maxLapsMin')),
    maxTimeInMinutes: Yup.string()
      .required(() => i18n.t('events:form.validation.maxTimeInMinutesRequired'))
      .oneOf(MAX_TIME_IN_MINUTES_OPTION_VALUES),
    maxRunsPerRacer: Yup.string().oneOf(MAX_RUNS_PER_RACER_OPTION_VALUES).default(''),
    maxResets: Yup.string()
      .required(() => i18n.t('events:form.validation.maxResetsRequired'))
      .oneOf(MAX_RESETS_OPTION_VALUES),
    averageLapsWindow: Yup.string().oneOf(AVERAGE_LAPS_WINDOW_OPTION_VALUES).default('3'),
    // Only required when creating: trackType isn't persisted on the Event (see
    // CreateEventFormValues), so an edit-mode form has no value to pre-populate it with
    // once tracks already exist — EventTracks derives its own effective layout from the
    // event's existing tracks in that case instead of this field.
    trackType: isEditMode
      ? Yup.string()
      : Yup.string().required(() => i18n.t('events:form.validation.trackTypeRequired')),
  });
