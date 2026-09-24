// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendCommandCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao } from '@deepracer-indy/database';
import {
  ChangeDeviceColorServerInput,
  ChangeDeviceColorServerOutput,
  DeviceColor,
  getChangeDeviceColorHandler,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Full-scale per-channel PWM the DeepRacer taillight firmware uses for a fully-on channel
 * (DREM `taillight_colors.MAX_PWM`).
 */
const MAX_PWM = 9999825;

/** The 7-colour palette (Smithy `DeviceColor`) mapped to per-channel PWM (on = MAX_PWM). */
const COLOR_PWM: Record<DeviceColor, { red: number; green: number; blue: number }> = {
  [DeviceColor.RED]: { red: MAX_PWM, green: 0, blue: 0 },
  [DeviceColor.GREEN]: { red: 0, green: MAX_PWM, blue: 0 },
  [DeviceColor.BLUE]: { red: 0, green: 0, blue: MAX_PWM },
  [DeviceColor.YELLOW]: { red: MAX_PWM, green: MAX_PWM, blue: 0 },
  [DeviceColor.CYAN]: { red: 0, green: MAX_PWM, blue: MAX_PWM },
  [DeviceColor.MAGENTA]: { red: MAX_PWM, green: 0, blue: MAX_PWM },
  [DeviceColor.WHITE]: { red: MAX_PWM, green: MAX_PWM, blue: MAX_PWM },
};

/**
 * Builds the ROS2 taillight command wrapped in the DREM `callRosService` preamble so the
 * SSM agent (root) can reach the DeepRacer ROS environment.
 */
const buildColorCommands = (color: DeviceColor): string[] => {
  const { red, green, blue } = COLOR_PWM[color];
  return [
    '#!/bin/bash',
    'export HOME="/home/deepracer"',
    'source $(find /opt/intel -name setupvars.sh)',
    'source /opt/aws/deepracer/lib/setup.bash',
    `ros2 service call /servo_pkg/set_led_state deepracer_interfaces_pkg/srv/SetLedCtrlSrv "{red: ${red}, blue: ${blue}, green: ${green}}"`,
  ];
};

/**
 * `PATCH /devices/{instanceId}/color` — set a car's taillight colour (Administrators and
 * Race Facilitators). Dispatches an SSM RunCommand invoking the DeepRacer taillight ROS2
 * service (DREM `carSetTaillightColor`). Idempotent and fire-and-forget: colour is cosmetic,
 * so no command id is returned. The `DeviceColor` enum is validated by the Smithy model.
 */
export const ChangeDeviceColorOperation: Operation<
  ChangeDeviceColorServerInput,
  ChangeDeviceColorServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can change device colour.' });
  }

  const { instanceId, color } = input;
  await deviceDao.load({ instanceId }); // 404 (NotFoundError) if unknown

  try {
    await ssmClient.send(
      new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: { commands: buildColorCommands(color) },
      }),
    );
  } catch (error) {
    logger.error('SSM SendCommand (color) failed', { action: 'DEVICE_COLOR_FAILURE', instanceId, color, error });
    throw new InternalFailureError({ message: 'Failed to dispatch colour change command.' });
  }

  logger.info('Device colour change dispatched', { action: 'DEVICE_COLOR', instanceId, color });
  return {} satisfies ChangeDeviceColorServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getChangeDeviceColorHandler(instrumentOperation(ChangeDeviceColorOperation)),
);
