// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AddTagsToResourceCommand, RemoveTagsFromResourceCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, fleetDao, type DeviceItem, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  CarType,
  DeviceType,
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

const applyFleetTag = async (instanceId: string, fleetId?: string): Promise<void> => {
  try {
    if (fleetId) {
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
};

const persistFleet = async (device: DeviceItem, nextFleetId?: ResourceId): Promise<DeviceItem> => {
  try {
    return await deviceDao.partialUpdate({ instanceId: device.instanceId }, { fleetId: nextFleetId });
  } catch (error) {
    logger.warn('Device fleet cache update failed after tag write; poller will reconcile', {
      action: 'DEVICE_FLEET_CACHE_UPDATE_FAILURE',
      instanceId: device.instanceId,
      fleetId: nextFleetId ?? null,
      error,
    });
    return { ...device, fleetId: nextFleetId };
  }
};

const persistCarType = async (instanceId: string, carType: CarType): Promise<DeviceItem> => {
  try {
    return await deviceDao.partialUpdate({ instanceId }, { carType });
  } catch (error) {
    logger.error('Failed to persist device car type', {
      action: 'DEVICE_CAR_TYPE_UPDATE_FAILURE',
      instanceId,
      carType,
      error,
    });
    throw new InternalFailureError({ message: 'Failed to persist the device car type.' });
  }
};

/**
 *
 * `fleetId` is treated as clear-when-omitted (preserving existing behavior); `carType` is
 * additive — omitting it leaves the stored car type unchanged.
 */
export const UpdateDeviceOperation: Operation<
  UpdateDeviceServerInput,
  UpdateDeviceServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can update devices.' });
  }

  const { instanceId, fleetId, carType } = input;
  const device = await deviceDao.load({ instanceId }); // 404 (NotFoundError) if the device is unknown

  // carType is meaningful only for cars; a timer has none. Reject early so a bad request never
  // reaches DynamoDB.
  if (carType !== undefined && device.deviceType !== DeviceType.CAR) {
    throw new BadRequestError({ message: 'carType can only be set on CAR devices.' });
  }

  const isCarTypeOnly = carType !== undefined && fleetId == null;
  const isFleetAffecting = !isCarTypeOnly;
  const nextFleetId = (fleetId as ResourceId | undefined) || undefined;

  let updated: DeviceItem = device;

  if (isFleetAffecting) {
    await applyFleetTag(instanceId, fleetId);
    updated = await persistFleet(device, nextFleetId);
  }

  if (carType !== undefined) {
    updated = await persistCarType(instanceId, carType);
    if (isFleetAffecting) {
      updated = { ...updated, fleetId: nextFleetId };
    }
  }

  logger.info('Device updated', {
    action: 'DEVICE_UPDATE',
    instanceId,
    fleetId: isFleetAffecting ? (fleetId ?? null) : undefined,
    carType: carType ?? null,
  });
  return { device: toDeviceResponse(updated) } satisfies UpdateDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getUpdateDeviceHandler(instrumentOperation(UpdateDeviceOperation)));
