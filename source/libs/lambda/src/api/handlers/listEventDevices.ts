// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, eventDao, fleetEventDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListEventDevicesHandler,
  ListEventDevicesServerInput,
  ListEventDevicesServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toDeviceResponse } from '../utils/toDeviceResponse.js';

/**
 * `GET /events/{eventId}/devices` — list every device in the fleets assigned to an event
 * (Administrators and Race Facilitators). Resolves the event's fleets (primary index), then
 * the devices per fleet (DevicesByFleet GSI). Status is DDB-only (no SSM merge).
 */
export const ListEventDevicesOperation: Operation<
  ListEventDevicesServerInput,
  ListEventDevicesServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can view event devices.' });
  }

  const eventId = input.eventId as ResourceId;
  await eventDao.load({ eventId }); // throws NotFoundError (404) if the event does not exist

  const assignedFleets = await fleetEventDao.listFleetsByEvent(eventId);
  const devicesPerFleet = await Promise.all(
    assignedFleets.map((assignment) => deviceDao.listByFleet(assignment.fleetId)),
  );

  return { devices: devicesPerFleet.flat().map(toDeviceResponse) } satisfies ListEventDevicesServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListEventDevicesHandler(instrumentOperation(ListEventDevicesOperation)),
);
