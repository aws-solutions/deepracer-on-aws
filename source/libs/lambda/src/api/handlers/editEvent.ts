// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  EditEventServerInput,
  EditEventServerOutput,
  EventStatus,
  getEditEventHandler,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toEventResponse } from '../utils/toEventResponse.js';

/** Fields that may only be edited while the event is in DRAFT state. */
const DRAFT_ONLY_FIELDS: (keyof EditEventServerInput['eventDefinition'])[] = [
  'eventType',
  'raceFormat',
  'maxLaps',
  'maxTimeInMinutes',
  'maxRunsPerRacer',
  'maxResets',
  'averageLapsWindow',
  'combinedScoringStrategy',
  'countryCode',
  'eventDate',
];

export const EditEventOperation: Operation<EditEventServerInput, EditEventServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can edit events.' });
  }

  const eventId = input.eventId as ResourceId;
  const { eventDefinition } = input;

  const existing = await eventDao.load({ eventId });

  if (existing.eventStatus !== EventStatus.DRAFT) {
    const hasRestrictedChange = DRAFT_ONLY_FIELDS.some(
      (field) => eventDefinition[field] !== undefined && eventDefinition[field] !== (existing as never)[field],
    );
    if (hasRestrictedChange) {
      throw new ConflictError({
        message: `Event is ${existing.eventStatus}. Only name and sponsor may be edited after DRAFT.`,
      });
    }
  }

  const updatedItem = await eventDao.partialUpdate(
    { eventId },
    {
      name: eventDefinition.name,
      eventType: eventDefinition.eventType,
      eventDate: eventDefinition.eventDate,
      countryCode: eventDefinition.countryCode,
      raceFormat: eventDefinition.raceFormat,
      maxLaps: eventDefinition.maxLaps,
      maxTimeInMinutes: eventDefinition.maxTimeInMinutes,
      maxResets: eventDefinition.maxResets,
      sponsor: eventDefinition.sponsor,
      maxRunsPerRacer: eventDefinition.maxRunsPerRacer,
      combinedScoringStrategy: eventDefinition.combinedScoringStrategy,
      combinedLeaderBoardHeader: eventDefinition.combinedLeaderBoardHeader,
      combinedLeaderBoardFooter: eventDefinition.combinedLeaderBoardFooter,
      averageLapsWindow: eventDefinition.averageLapsWindow,
    },
  );

  return { event: toEventResponse(updatedItem) } satisfies EditEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getEditEventHandler(instrumentOperation(EditEventOperation)));
