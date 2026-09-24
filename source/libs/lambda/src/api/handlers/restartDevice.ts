// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendCommandCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao } from '@deepracer-indy/database';
import {
  getRestartDeviceHandler,
  InternalFailureError,
  NotAuthorizedError,
  RestartDeviceServerInput,
  RestartDeviceServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Shell commands run on the device via SSM RunCommand to restart the DeepRacer inference
 * stack (DREM `carRestartService`). `HOME` is exported because the agent runs as root but
 * deepracer-core resolves paths relative to the deepracer user's home.
 */
const RESTART_COMMANDS = ['#!/bin/bash', 'export HOME="/home/deepracer"', 'systemctl restart deepracer-core'];

/**
 * `POST /devices/{instanceId}/restart` — restart the `deepracer-core` service on a device
 * (Administrators and Race Facilitators).
 *
 * Dispatches an async SSM RunCommand (DREM parity) and returns **202** with the `commandId`
 * immediately — there is no synchronous polling. The command outcome is delivered
 * asynchronously via the SSM State Change Handler → device row → DynamoDB stream →
 * BroadcastHandler → IoT (browser) path, where the console reconciles the pending
 * command against a 30s client timeout.
 */
export const RestartDeviceOperation: Operation<
  RestartDeviceServerInput,
  RestartDeviceServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can restart devices.' });
  }

  const { instanceId } = input;
  // 404 if the device is unknown (load throws NotFoundError).
  await deviceDao.load({ instanceId });

  let commandId: string | undefined;
  try {
    const response = await ssmClient.send(
      new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: { commands: RESTART_COMMANDS },
      }),
    );
    commandId = response.Command?.CommandId;
  } catch (error) {
    logger.error('SSM SendCommand (restart) failed', { action: 'DEVICE_RESTART_FAILURE', instanceId, error });
    throw new InternalFailureError({ message: 'Failed to dispatch restart command.' });
  }

  if (!commandId) {
    logger.error('SSM SendCommand returned no CommandId', { action: 'DEVICE_RESTART_FAILURE', instanceId });
    throw new InternalFailureError({ message: 'Failed to dispatch restart command.' });
  }

  logger.info('Device restart dispatched', { action: 'DEVICE_RESTART', instanceId, commandId });
  return { commandId } satisfies RestartDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getRestartDeviceHandler(instrumentOperation(RestartDeviceOperation)));
