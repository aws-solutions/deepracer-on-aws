// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeregisterManagedInstanceCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, fleetEventDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  DeleteDeviceServerInput,
  DeleteDeviceServerOutput,
  getDeleteDeviceHandler,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `DELETE /devices/{instanceId}` — deregister a device from SSM and remove its record
 * (Administrators and race facilitators).
 *
 * Rejects with 409 Conflict when the device's fleet is assigned to an event: removing a
 * device that an event depends on would disrupt the event. The check mirrors
 * `deleteFleet` — any fleet→event assignment (EventsByFleet GSI) counts as "in use". Loads
 * the device first so a missing device returns 404. Deregisters the managed instance before
 * deleting the row so a failed deregister does not orphan an SSM instance.
 */
export const DeleteDeviceOperation: Operation<
  DeleteDeviceServerInput,
  DeleteDeviceServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can delete devices.' });
  }

  const { instanceId } = input;
  const device = await deviceDao.load({ instanceId }); // 404 (NotFoundError) if unknown

  // 409 if the device's fleet is assigned to an event (it — and this device — is in use).
  if (device.fleetId) {
    const assignedEvents = await fleetEventDao.listEventsByFleet(device.fleetId as ResourceId);
    if (assignedEvents.length > 0) {
      throw new ConflictError({
        message:
          'Device belongs to a fleet assigned to an event and cannot be deleted. Remove it from the event first.',
      });
    }
  }

  try {
    await ssmClient.send(new DeregisterManagedInstanceCommand({ InstanceId: instanceId }));
  } catch (error) {
    logger.error('SSM DeregisterManagedInstance failed', { action: 'DEVICE_DELETE_FAILURE', instanceId, error });
    throw new InternalFailureError({ message: 'Failed to deregister the device from Systems Manager.' });
  }

  await deviceDao.delete({ instanceId });

  logger.info('Device deleted', { action: 'DEVICE_DELETE', instanceId });
  return {} satisfies DeleteDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getDeleteDeviceHandler(instrumentOperation(DeleteDeviceOperation)));
