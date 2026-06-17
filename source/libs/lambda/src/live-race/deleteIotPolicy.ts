// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DetachPolicyCommand, IoTClient, ListTargetsForPolicyCommand, DeletePolicyCommand } from '@aws-sdk/client-iot';
import { logger } from '@deepracer-indy/utils';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';

const iotClient = new IoTClient({ maxAttempts: 5 });

/** Detach all principals from the policy so it can be deleted. No-ops on Create/Update. */
export const onEventHandler = async (
  event: CloudFormationCustomResourceEvent,
): Promise<{ PhysicalResourceId: string } | void> => {
  if (event.RequestType !== 'Delete') {
    const policyName = event.ResourceProperties.policyName as string;
    return { PhysicalResourceId: policyName };
  }

  const policyName = event.ResourceProperties.policyName as string;

  try {
    // Detach all principals before deleting — DeletePolicy fails with DeleteConflictException if any are attached.
    let marker: string | undefined;
    do {
      const { targets = [], nextMarker } = await iotClient.send(
        new ListTargetsForPolicyCommand({ policyName, marker, pageSize: 250 }),
      );
      for (const target of targets) {
        try {
          await iotClient.send(new DetachPolicyCommand({ policyName, target }));
        } catch (err) {
          const name = (err as { name?: string }).name;
          if (name !== 'ResourceNotFoundException' && name !== 'UnauthorizedException') throw err;
        }
      }
      marker = nextMarker;
    } while (marker);
  } catch (err) {
    if ((err as { name?: string }).name === 'ResourceNotFoundException') {
      logger.info('IoT policy already deleted (idempotent)', { policyName });
      return;
    }
    throw err;
  }
};

/**
 * Attempts to delete the policy. Returns IsComplete: false on DeleteConflictException,
 * which the Provider framework retries — covering AWS's post-detach propagation window.
 */
export const isCompleteHandler = async (event: CloudFormationCustomResourceEvent): Promise<{ IsComplete: boolean }> => {
  if (event.RequestType !== 'Delete') return { IsComplete: true };

  const policyName = event.ResourceProperties.policyName as string;

  try {
    await iotClient.send(new DeletePolicyCommand({ policyName }));
    logger.info('IoT policy deleted', { policyName });
    return { IsComplete: true };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'DeleteConflictException') return { IsComplete: false };
    if (name === 'ResourceNotFoundException') {
      logger.info('IoT policy already deleted (idempotent)', { policyName });
      return { IsComplete: true };
    }
    throw err;
  }
};
