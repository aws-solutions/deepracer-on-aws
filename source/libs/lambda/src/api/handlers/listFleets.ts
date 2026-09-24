// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, fleetDao } from '@deepracer-indy/database';
import {
  getListFleetsHandler,
  ListFleetsServerInput,
  ListFleetsServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toFleetResponse } from '../utils/toFleetResponse.js';

/**
 * `GET /fleets` — list fleets with their device counts (Administrators and race facilitators). Counts come
 * from the DevicesByFleet GSI; at the intended scale (≤20 fleets) the per-fleet
 * count query is inexpensive.
 */
export const ListFleetsOperation: Operation<ListFleetsServerInput, ListFleetsServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can list fleets.' });
  }

  const { data: fleets, cursor } = await fleetDao.list({ cursor: input.token });

  const fleetResponses = await Promise.all(
    fleets.map(async (fleet) => toFleetResponse(fleet, (await deviceDao.listByFleet(fleet.fleetId)).length)),
  );

  return { fleets: fleetResponses, token: cursor ?? undefined } satisfies ListFleetsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getListFleetsHandler(instrumentOperation(ListFleetsOperation)));
