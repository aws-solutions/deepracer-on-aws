// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AddTagsToResourceCommand, RemoveTagsFromResourceCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, fleetDao, type DeviceItem, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  getUpdateDeviceHandler,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
  UpdateDeviceServerInput,
  UpdateDeviceServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toDeviceResponse } from '../utils/toDeviceResponse.js';

/** SSM tag whose value the status poller reads back to populate `DeviceEntity.fleetId`. */
const FLEET_TAG_KEY = 'fleetId';

/**
 * `PATCH /devices/{instanceId}` — reassign (or clear) a device's fleet (Administrators and race facilitators —
 * fleet management is admin-scoped).
 *
 * This op's only mutable field is `fleetId`: provide it to move the device to that fleet,
 * omit it to unassign. Because the Task 5 status poller reconstructs `fleetId` from the SSM
 * managed-instance tag, the tag is updated **first** (source of truth) — if that fails we
 * abort before touching DynamoDB, avoiding drift where the next poll reverts the change.
 * Mirrors DREM `cars_function/carsUpdateFleet`.
 */
export const UpdateDeviceOperation: Operation<
  UpdateDeviceServerInput,
  UpdateDeviceServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can reassign device fleets.' });
  }

  const { instanceId, fleetId } = input;
  const device = await deviceDao.load({ instanceId }); // 404 (NotFoundError) if the device is unknown

  try {
    if (fleetId) {
      // Assigning to a fleet: the fleet must exist (400 if not), then set the tag.
      try {
        await fleetDao.load({ fleetId: fleetId as ResourceId });
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new BadRequestError({ message: `Fleet ${fleetId} does not exist.` });
        }
        throw error;
      }
      await ssmClient.send(
        new AddTagsToResourceCommand({
          ResourceType: 'ManagedInstance',
          ResourceId: instanceId,
          Tags: [{ Key: FLEET_TAG_KEY, Value: fleetId }],
        }),
      );
    } else {
      // Unassigning: remove the fleetId tag so the poller won't re-populate it.
      await ssmClient.send(
        new RemoveTagsFromResourceCommand({
          ResourceType: 'ManagedInstance',
          ResourceId: instanceId,
          TagKeys: [FLEET_TAG_KEY],
        }),
      );
    }
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    logger.error('Failed to update device fleet tag in SSM', {
      action: 'DEVICE_FLEET_UPDATE_FAILURE',
      instanceId,
      error,
    });
    throw new InternalFailureError({ message: 'Failed to update the device fleet.' });
  }

  // The SSM tag is the source of truth and is now set (the device moved). Update the DynamoDB
  // cache best-effort — the poller reconciles fleetId from the tag regardless, so a cache-write
  // failure must not surface a spurious 500 for a change that already took effect (matches
  // batchUpdateDevice). Passing `undefined` clears the attribute (BaseDao removes undefined fields).
  const nextFleetId = (fleetId as ResourceId | undefined) || undefined;
  let updated: DeviceItem;
  try {
    updated = await deviceDao.partialUpdate({ instanceId }, { fleetId: nextFleetId });
  } catch (error) {
    logger.warn('Device fleet tag set but DynamoDB cache update failed; poller will reconcile', {
      action: 'DEVICE_FLEET_CACHE_UPDATE_FAILURE',
      instanceId,
      fleetId: fleetId ?? null,
      error,
    });
    // Reflect the applied change on the already-loaded entity so the response is still accurate.
    updated = { ...device, fleetId: nextFleetId };
  }

  logger.info('Device fleet updated', { action: 'DEVICE_FLEET_UPDATE', instanceId, fleetId: fleetId ?? null });
  return { device: toDeviceResponse(updated) } satisfies UpdateDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getUpdateDeviceHandler(instrumentOperation(UpdateDeviceOperation)));
