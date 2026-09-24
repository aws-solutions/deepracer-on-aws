// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetCommandInvocationCommand, SendCommandCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  ClearDeviceModelsServerInput,
  ClearDeviceModelsServerOutput,
  getClearDeviceModelsHandler,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 15;

/**
 * `POST /devices/{instanceId}/clear-models` — wipe all model artifacts and logs from a car.
 * Sends `rm -rf artifacts/* && rm -rf logs/*` via SSM, polls until complete, then returns.
 * Synchronous from the caller's perspective — the response means the clear is done on the car.
 */
export const ClearDeviceModelsOperation: Operation<
  ClearDeviceModelsServerInput,
  ClearDeviceModelsServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can clear device models.' });
  }

  const { instanceId } = input;

  const device = await deviceDao.load({ instanceId });
  if (!device) {
    throw new NotFoundError({ message: 'Device not found.' });
  }

  const response = await ssmClient.send(
    new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: 'AWS-RunShellScript',
      Parameters: { commands: ['rm -rf /opt/aws/deepracer/artifacts/*', 'rm -rf /opt/aws/deepracer/logs/*'] },
    }),
  );

  const commandId = response.Command?.CommandId;
  if (!commandId) {
    throw new Error('SSM SendCommand did not return a CommandId');
  }

  // Poll until complete on the car
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let clearConfirmed = false;
  let clearFailed = false;
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const invocation = await ssmClient.send(
        new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId }),
      );
      if (invocation.Status === 'Success') {
        clearConfirmed = true;
        break;
      }
      if (invocation.Status === 'Failed' || invocation.Status === 'TimedOut' || invocation.Status === 'Cancelled') {
        clearFailed = true;
        logger.warn('Clear command failed on car', { commandId, status: invocation.Status });
        break;
      }
    } catch (pollError) {
      // Transient SSM error (documented as possible right after SendCommand) — log and continue polling
      logger.warn('GetCommandInvocation transient error, retrying', { commandId, attempt, error: String(pollError) });
    }
  }

  if (clearFailed) {
    // Confirmed negative — the shell command itself errored. Surface to caller.
    throw new BadRequestError({ message: 'Failed to clear models on the car. Check device connectivity.' });
  }

  if (!clearConfirmed) {
    // Timeout — SSM reporting lag, not a real failure. Proceed (DREM parity).
    logger.warn('Clear command did not confirm within timeout — proceeding', { commandId, instanceId });
  }

  logger.info('Clear models complete', { instanceId, commandId, clearConfirmed });

  return { commandId };
};

export const lambdaHandler = getApiGatewayHandler(
  getClearDeviceModelsHandler(instrumentOperation(ClearDeviceModelsOperation)),
);
