// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { fleetDao, fleetEventDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  DeleteFleetServerInput,
  DeleteFleetServerOutput,
  getDeleteFleetHandler,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `DELETE /fleets/{fleetId}` — delete a fleet (Administrators and race facilitators).
 *
 * Rejects with 409 Conflict when the fleet is still assigned to an event: an assignment
 * (FleetEventEntity) means the fleet — and its devices — are in use, so removing it would
 * disrupt the event. The check uses the EventsByFleet GSI. Loads the
 * fleet first so a missing fleet returns 404.
 */
export const DeleteFleetOperation: Operation<DeleteFleetServerInput, DeleteFleetServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can delete fleets.' });
  }

  const fleetId = input.fleetId as ResourceId;
  await fleetDao.load({ fleetId }); // throws NotFoundError if the fleet does not exist

  const assignedEvents = await fleetEventDao.listEventsByFleet(fleetId);
  if (assignedEvents.length > 0) {
    throw new ConflictError({
      message: 'Fleet is assigned to an event and cannot be deleted. Remove the assignment first.',
    });
  }

  await fleetDao.delete({ fleetId });

  return {} satisfies DeleteFleetServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getDeleteFleetHandler(instrumentOperation(DeleteFleetOperation)));
