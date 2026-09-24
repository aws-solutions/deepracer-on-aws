// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { SendCommandCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import { deviceDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  DeviceType,
  getStopDeviceHandler,
  InternalFailureError,
  NotAuthorizedError,
  StopDeviceServerInput,
  StopDeviceServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metrics } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * ROS2 service call that disables the motor control state, halting the car (DREM
 * `carEmergencyStop`). Wrapped in the DREM `callRosService` preamble so the SSM agent
 * (running as root) can reach the DeepRacer ROS environment.
 */
const STOP_COMMANDS = [
  '#!/bin/bash',
  'export HOME="/home/deepracer"',
  'source $(find /opt/intel -name setupvars.sh)',
  'source /opt/aws/deepracer/lib/setup.bash',
  'ros2 service call /ctrl_pkg/enable_state deepracer_interfaces_pkg/srv/EnableStateSrv "{is_active: false}"',
];

/**
 * `POST /devices/{instanceId}/stop` — emergency-stop a car (Administrators and Race
 * Facilitators).
 *
 * Single-path SSM RunCommand:
 * Dispatches the ROS2 disable command and returns **202** with the `commandId` immediately.
 * The outcome is delivered asynchronously through the SSM State Change Handler, device row,
 * stream, BroadcastHandler, and IoT browser update path.
 *
 * Only `CAR` devices can be stopped (timers have no motor state). There is intentionally
 * **no `PingStatus` pre-check** — offline enforcement is client-side UI gating;
 * a queued stop on an offline car still returns 202.
 *
 * Emits the `CommandDispatchLatency` metric (API receipt → SendCommand returned) that backs
 * the `EmergencyStopDispatchLatency` alarm.
 */
export const StopDeviceOperation: Operation<StopDeviceServerInput, StopDeviceServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const start = Date.now();
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can stop devices.' });
  }

  const { instanceId } = input;
  const device = await deviceDao.load({ instanceId }); // 404 (NotFoundError) if unknown

  // Only cars have a motor control state to disable; timers cannot be stopped.
  if (device.deviceType !== DeviceType.CAR) {
    throw new BadRequestError({ message: 'Emergency stop is only supported for cars.' });
  }

  let commandId: string | undefined;
  try {
    const response = await ssmClient.send(
      new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: { commands: STOP_COMMANDS },
      }),
    );
    commandId = response.Command?.CommandId;
  } catch (error) {
    logger.error('SSM SendCommand (stop) failed', { action: 'EMERGENCY_STOP_FAILURE', instanceId, error });
    throw new InternalFailureError({ message: 'Failed to dispatch emergency stop command.' });
  }

  if (!commandId) {
    logger.error('SSM SendCommand returned no CommandId', { action: 'EMERGENCY_STOP_FAILURE', instanceId });
    throw new InternalFailureError({ message: 'Failed to dispatch emergency stop command.' });
  }

  // Dispatch latency (API receipt → SendCommand returned) for the EmergencyStopDispatchLatency
  // alarm. Best-effort: never let a metrics failure break the stop response.
  try {
    metrics.addMetric('CommandDispatchLatency', MetricUnit.Milliseconds, Date.now() - start);
  } catch (metricError) {
    logger.warn('Failed to publish CommandDispatchLatency metric', { instanceId, metricError });
  }

  logger.info('Emergency stop dispatched', { action: 'EMERGENCY_STOP', instanceId, commandId });
  return { commandId } satisfies StopDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getStopDeviceHandler(instrumentOperation(StopDeviceOperation)));
