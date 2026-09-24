// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, fleetDao, fleetEventDao, type ResourceId } from '@deepracer-indy/database';
import {
  AssignEventFleetsServerInput,
  AssignEventFleetsServerOutput,
  BadRequestError,
  getAssignEventFleetsHandler,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `POST /events/{eventId}/fleets` — assign one or more fleets to an event (Administrators
 * and race facilitators). The event must exist (404) and every fleet must exist (400). Assignment is
 * additive and idempotent: fleets already assigned are left as-is.
 */
export const AssignEventFleetsOperation: Operation<
  AssignEventFleetsServerInput,
  AssignEventFleetsServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can assign fleets to events.' });
  }

  const eventId = input.eventId as ResourceId;
  await eventDao.load({ eventId }); // throws NotFoundError (404) if the event does not exist

  const fleetIds = input.fleetIds as ResourceId[];
  const alreadyAssigned = new Set(
    (await fleetEventDao.listFleetsByEvent(eventId)).map((assignment) => assignment.fleetId),
  );

  // Phase 1: validate every fleet exists before mutating anything, so a bad fleet in the
  // batch rejects the whole request without leaving a partial assignment persisted.
  for (const fleetId of fleetIds) {
    try {
      await fleetDao.load({ fleetId });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new BadRequestError({ message: `Fleet ${fleetId} does not exist.` });
      }
      throw error;
    }
  }

  // Phase 2: assign only the fleets not already assigned (additive + idempotent).
  for (const fleetId of fleetIds) {
    if (!alreadyAssigned.has(fleetId)) {
      await fleetEventDao.assign({ eventId, fleetId });
    }
  }

  return { assignedFleetIds: fleetIds } satisfies AssignEventFleetsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getAssignEventFleetsHandler(instrumentOperation(AssignEventFleetsOperation)),
);
