// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeregisterManagedInstanceCommand } from '@aws-sdk/client-ssm';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

/**
 * Fan-out payload sent by the BroadcastHandler when a `device#` row is removed by DynamoDB
 * TTL expiry.
 */
export interface DevicePruneEvent {
  instanceIds: string[];
}

/**
 * Device Pruning Lambda.
 *
 */
export const PruneDevices = async (event: DevicePruneEvent): Promise<void> => {
  const instanceIds = event.instanceIds ?? [];
  if (instanceIds.length === 0) {
    logger.warn('Device prune invoked with no instanceIds', { event });
    return;
  }

  let pruned = 0;
  for (const instanceId of instanceIds) {
    try {
      await ssmClient.send(new DeregisterManagedInstanceCommand({ InstanceId: instanceId }));
      pruned += 1;
      logger.info('Deregistered pruned device from SSM', { action: 'DEVICE_PRUNED', instanceId });
    } catch (error) {
      // Skip and continue — a failed deregister must not block pruning of the rest.
      logger.error('Failed to deregister pruned device', { action: 'DEVICE_PRUNE_FAILURE', instanceId, error });
    }
  }

  logger.info('Device prune complete', { requested: instanceIds.length, pruned });
};

export const lambdaHandler = instrumentHandler(PruneDevices);
