// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AddTagsToResourceCommand, RemoveTagsFromResourceCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, fleetDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  BatchUpdateDeviceError,
  BatchUpdateDeviceServerInput,
  BatchUpdateDeviceServerOutput,
  getBatchUpdateDeviceHandler,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** SSM tag whose value the status poller reads back to populate `DeviceEntity.fleetId`. */
const FLEET_TAG_KEY = 'fleetId';

/**
 * Bulk fan-out width: devices are applied in concurrency-limited chunks (rather than strictly
 * sequentially) to bound SSM/DynamoDB parallelism, mirroring getEventStatistics' lap-query
 * chunking. ~100 devices at width 10 → ~10 round-trip waves instead of ~100 serial ones.
 */
const DEVICE_UPDATE_CONCURRENCY = Number(process.env.DEVICE_UPDATE_CONCURRENCY ?? 10);

/** Validate the target fleet exists (400 if not). No-op when unassigning (no fleetId). */
const validateFleetExists = async (fleetId?: string): Promise<void> => {
  if (!fleetId) {
    return;
  }
  try {
    await fleetDao.load({ fleetId: fleetId as ResourceId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new BadRequestError({ message: `Fleet ${fleetId} does not exist.` });
    }
    throw error;
  }
};

/** Write (or clear) the device's fleetId tag — the poller's source of truth. Throws on failure. */
const writeDeviceFleetTag = async (instanceId: string, fleetId?: string): Promise<void> => {
  if (fleetId) {
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
};

/**
 * Best-effort DynamoDB cache write after the tag (source of truth) is set. A failure is logged
 * but does not fail the item — the poller reconciles fleetId from the tag on the next cycle.
 */
const updateDeviceFleetCache = async (instanceId: string, fleetId?: string): Promise<void> => {
  try {
    await deviceDao.partialUpdate({ instanceId }, { fleetId: (fleetId as ResourceId | undefined) || undefined });
  } catch (error) {
    logger.warn('Device fleet tag set but DynamoDB cache update failed; poller will reconcile', {
      action: 'DEVICE_FLEET_CACHE_UPDATE_FAILURE',
      instanceId,
      fleetId: fleetId ?? null,
      error,
    });
  }
};

/** Build (and log) a structured per-item error for a device whose tag write failed. */
const toBatchError = (instanceId: string, fleetId: string | undefined, error: unknown): BatchUpdateDeviceError => {
  const code = (error as { name?: string }).name ?? 'InternalFailure';
  const message = error instanceof Error ? error.message : 'Failed to update the device fleet.';
  logger.warn('Failed to update device fleet', {
    action: 'DEVICE_FLEET_ASSIGN_FAILURE',
    instanceId,
    fleetId: fleetId ?? null,
    error,
  });
  return { instanceId, code, message };
};

/**
 * `POST /devices/batch-update` — the batch analogue of `UpdateDevice`: bulk-assign (or
 * unassign) up to 100 devices to a fleet in one call (Administrators and race facilitators), matching DREM
 * `carsUpdateFleet`. The target fleet is validated **once** (400 if missing), then each device
 * is applied independently with **continue-on-failure** — a single bad instance does not fail
 * the batch.
 *
 * For each device the SSM `fleetId` tag (the poller's source of truth) is written **first**,
 * matching `updateDevice`: if the tag write fails the device did not move, so it is returned in
 * `errors` and DynamoDB is left untouched. On success the DynamoDB row is updated best-effort
 * for immediate UI (the poller reconciles it from the tag regardless, so a cache-write failure
 * does not fail the item). Per-item failures are returned in `errors`, each carrying the
 * `instanceId`, an error `code`, and a `message` (Batch Operations standard).
 */
export const BatchUpdateDeviceOperation: Operation<
  BatchUpdateDeviceServerInput,
  BatchUpdateDeviceServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can update device fleets.' });
  }

  const { instanceIds, fleetId } = input;

  // Validate the target fleet once (400 if it does not exist) before touching any device.
  await validateFleetExists(fleetId);

  // Apply each device independently (continue-on-failure), in concurrency-limited chunks so a
  // large batch doesn't serialize ~2 round trips per device. Returns null on success, else a
  // structured per-item error.
  const applyDevice = async (instanceId: string): Promise<BatchUpdateDeviceError | null> => {
    try {
      // SSM tag first (source of truth): a tag failure means the device did not move.
      await writeDeviceFleetTag(instanceId, fleetId);
    } catch (error) {
      return toBatchError(instanceId, fleetId, error);
    }
    // Tag set → the device moved; update the DynamoDB cache best-effort for immediate UI.
    await updateDeviceFleetCache(instanceId, fleetId);
    return null;
  };

  const assignedInstanceIds: string[] = [];
  const errors: BatchUpdateDeviceError[] = [];

  for (let i = 0; i < instanceIds.length; i += DEVICE_UPDATE_CONCURRENCY) {
    const chunk = instanceIds.slice(i, i + DEVICE_UPDATE_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(applyDevice));
    chunk.forEach((instanceId, idx) => {
      const error = chunkResults[idx];
      if (error) {
        errors.push(error);
      } else {
        assignedInstanceIds.push(instanceId);
      }
    });
  }

  logger.info('Batch device update complete', {
    action: 'DEVICE_FLEET_ASSIGN',
    fleetId: fleetId ?? null,
    assigned: assignedInstanceIds.length,
    failed: errors.length,
  });

  return { assignedInstanceIds, errors } satisfies BatchUpdateDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getBatchUpdateDeviceHandler(instrumentOperation(BatchUpdateDeviceOperation)),
);
