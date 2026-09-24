// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { fleetDao, type ResourceId } from '@deepracer-indy/database';
import {
  getUpdateFleetHandler,
  NotAuthorizedError,
  UpdateFleetServerInput,
  UpdateFleetServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toFleetResponse } from '../utils/toFleetResponse.js';

/**
 * `PATCH /fleets/{fleetId}` — update a fleet's name (Administrators and race facilitators).
 * Loads first so a missing fleet returns 404 (NotFoundError) rather than a patch error.
 */
export const UpdateFleetOperation: Operation<UpdateFleetServerInput, UpdateFleetServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can update fleets.' });
  }

  const fleetId = input.fleetId as ResourceId;
  await fleetDao.load({ fleetId }); // throws NotFoundError if the fleet does not exist

  const updated = await fleetDao.partialUpdate({ fleetId }, { ...(input.name && { name: input.name }) });

  return { fleet: toFleetResponse(updated) } satisfies UpdateFleetServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getUpdateFleetHandler(instrumentOperation(UpdateFleetOperation)));
