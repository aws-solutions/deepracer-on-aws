// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CombinedScoringStrategy, Event, EventType, RaceFormat } from '@deepracer-indy/typescript-client';

import { CreateEventFormValues } from '../../validation';

/**
 * The shape submitted to CreateEvent/EditEvent. Kept structural (not the generated
 * EventDefinition) so create (all fields present) and edit (some fields fall back to the
 * existing event) share one mapping without over-constraining optional fields.
 */
export interface EventDefinitionInput {
  name?: string;
  eventType?: EventType;
  eventDate?: string;
  countryCode?: string;
  sponsor?: string;
  raceFormat: RaceFormat;
  combinedScoringStrategy?: CombinedScoringStrategy;
  combinedLeaderBoardHeader?: string;
  combinedLeaderBoardFooter?: string;
  maxLaps?: number;
  maxTimeInMinutes?: number;
  maxRunsPerRacer?: number;
  maxResets?: number;
  averageLapsWindow?: number;
}

/**
 * Maps the RHF form values to the event-definition payload shared by CreateEvent and
 * EditEvent.
 *
 * `existingEvent` and `isConfigLocked` only apply to edit mode:
 * - RHF omits disabled fields (they resolve to undefined). When a field is locked
 *   (isConfigLocked), fall back to the existing event's value so the API receives the
 *   full object rather than undefined — which BaseDao.partialUpdate would treat as a
 *   DELETE on that DynamoDB attribute.
 * - In create mode, existingEvent is undefined and isConfigLocked is false, so every
 *   value comes straight from the form.
 */
export const buildEventDefinition = (
  data: CreateEventFormValues,
  { existingEvent, isConfigLocked = false }: { existingEvent?: Event; isConfigLocked?: boolean } = {},
): EventDefinitionInput => {
  const effectiveRaceFormat = (data.raceFormat || existingEvent?.raceFormat) as RaceFormat;
  let maxRunsPerRacer: number | undefined;
  let averageLapsWindow: number | undefined;
  if (isConfigLocked) {
    maxRunsPerRacer = existingEvent?.maxRunsPerRacer;
    averageLapsWindow = existingEvent?.averageLapsWindow;
  } else {
    maxRunsPerRacer = data.maxRunsPerRacer ? Number(data.maxRunsPerRacer) : undefined;
    averageLapsWindow = effectiveRaceFormat === RaceFormat.AVERAGE_LAPS ? Number(data.averageLapsWindow) : undefined;
  }
  return {
    name: data.name ?? existingEvent?.name,
    eventType: (data.eventType || existingEvent?.eventType) as EventType,
    eventDate: data.eventDate ?? existingEvent?.eventDate,
    countryCode: data.countryCode ?? existingEvent?.countryCode,
    // sponsor: undefined = disabled (fall back to existing); '' = intentionally cleared (send undefined)
    sponsor: data.sponsor === undefined ? existingEvent?.sponsor : data.sponsor || undefined,
    raceFormat: effectiveRaceFormat,
    // combinedScoringStrategy: undefined = disabled (fall back); '' = intentionally cleared (send undefined)
    combinedScoringStrategy:
      data.combinedScoringStrategy === undefined
        ? existingEvent?.combinedScoringStrategy
        : data.combinedScoringStrategy || undefined,
    // Combined header/footer are cosmetic text editable while DRAFT or OPEN (like the
    // per-track footer), so they always take the submitted value; '' clears them.
    combinedLeaderBoardHeader:
      data.combinedLeaderBoardHeader === undefined
        ? existingEvent?.combinedLeaderBoardHeader
        : data.combinedLeaderBoardHeader || undefined,
    combinedLeaderBoardFooter:
      data.combinedLeaderBoardFooter === undefined
        ? existingEvent?.combinedLeaderBoardFooter
        : data.combinedLeaderBoardFooter || undefined,
    maxLaps: data.maxLaps ?? existingEvent?.maxLaps,
    maxTimeInMinutes: isConfigLocked
      ? existingEvent?.maxTimeInMinutes
      : Number(data.maxTimeInMinutes ?? existingEvent?.maxTimeInMinutes),
    // maxRunsPerRacer is editable in DRAFT; only fall back when the field is locked (undefined from RHF).
    // '' selects "Unlimited" in the Select — map it to undefined for the API either way.
    maxRunsPerRacer: maxRunsPerRacer,
    // maxResets: '9999' selects "Unlimited" in the Select — sent to the API as the literal
    // sentinel value (maxResets is @required end-to-end, unlike maxRunsPerRacer).
    maxResets: isConfigLocked ? existingEvent?.maxResets : Number(data.maxResets ?? existingEvent?.maxResets),
    // averageLapsWindow is only meaningful when the effective raceFormat is AVERAGE_LAPS —
    // otherwise the field is disabled/inert (matching DREM's behavior), so send undefined.
    averageLapsWindow: averageLapsWindow,
  };
};
