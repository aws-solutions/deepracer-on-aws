// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { CreateActivationCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import {
  ActivateDeviceServerInput,
  ActivateDeviceServerOutput,
  getActivateDeviceHandler,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metrics } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Control tag stamped on every DeepRacer-onboarded managed instance. SSM propagates tags
 * supplied on `CreateActivation` to the managed instance when it registers, so this tag
 * is what the device-management IAM roles scope on: the command Lambdas gate
 * `ssm:SendCommand` and the Activation/Pruning Lambdas gate `ssm:DeregisterManagedInstance`
 * with `ssm:resourceTag/deepracer:managed = true`. Keep in sync with
 * `DEEPRACER_MANAGED_TAG_CONDITION` in apps/infra/lib/constructs/device-management/deviceManagementInfra.ts.
 */
const DEEPRACER_MANAGED_TAG_KEY = 'deepracer:managed';

/**
 * SSM hybrid activation code validity window. The operator must run the activation script
 * on the device within this window (activation codes are short-lived, no long-lived credentials are issued).
 */
const ACTIVATION_VALIDITY_MS = 24 * 60 * 60 * 1000;

/**
 * `POST /devices/activate` — create an SSM hybrid activation for a new car or timer and
 * return the activation parameters.
 *
 * This mirrors DREM's `device_activation_function`: the handler only creates the activation
 * and hands back `{activationId, activationCode, region, expiresAt}`. The operator runs the
 * website-hosted activation script (`car_activation.sh` / `timer_activation.sh`) on the
 * device with these parameters; the SSM agent registers outbound, and the device's
 * DynamoDB row is created later by the status poller once SSM reports the managed
 * instance. **No device record is written at activation time** — matching
 * DREM, whose activation Lambda does not persist a row.
 */
/**
 * Emit the `ActivationFailure` count metric that backs the `ActivationFailureRate` alarm
 * (> 3 failures in 15 min may indicate SSM quota or IAM issues). Best-effort:
 * metric emission must never mask the underlying activation error.
 */
const recordActivationFailure = (): void => {
  try {
    metrics.addMetric('ActivationFailure', MetricUnit.Count, 1);
  } catch (metricError) {
    logger.warn('Failed to publish ActivationFailure metric', { metricError });
  }
};

export const ActivateDeviceOperation: Operation<
  ActivateDeviceServerInput,
  ActivateDeviceServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  // Device activation is restricted to administrators and race facilitators.
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can activate devices.' });
  }

  // Role name handed to SSM as the instance role the agent assumes after registration.
  const hybridActivationRoleName = process.env.HYBRID_ACTIVATION_IAM_ROLE_NAME;
  if (!hybridActivationRoleName) {
    logger.error('Missing required environment variable', { variable: 'HYBRID_ACTIVATION_IAM_ROLE_NAME' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }
  const region = process.env.AWS_REGION;
  if (!region) {
    logger.error('Missing required environment variable', { variable: 'AWS_REGION' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  const { name, deviceType, fleetId } = input;
  const expiresAt = new Date(Date.now() + ACTIVATION_VALIDITY_MS);

  // Tags propagate to the managed instance at registration. `deepracer:managed=true` is the
  // basis for the RunCommand/deregister IAM scoping; Type/fleetId are read back by the
  // status poller (Task 5) when it builds the device row.
  const tags = [
    { Key: 'Name', Value: name },
    { Key: 'Type', Value: deviceType },
    { Key: DEEPRACER_MANAGED_TAG_KEY, Value: 'true' },
    ...(fleetId ? [{ Key: 'fleetId', Value: fleetId }] : []),
  ];

  let activationId: string | undefined;
  let activationCode: string | undefined;
  try {
    const response = await ssmClient.send(
      new CreateActivationCommand({
        DefaultInstanceName: name,
        Description: `DeepRacer ${deviceType} activation for ${name}`,
        IamRole: hybridActivationRoleName,
        RegistrationLimit: 1,
        ExpirationDate: expiresAt,
        Tags: tags,
      }),
    );
    activationId = response.ActivationId;
    activationCode = response.ActivationCode;
  } catch (error) {
    logger.error('SSM CreateActivation failed', { action: 'DEVICE_ACTIVATION_FAILURE', deviceType, error });
    recordActivationFailure();
    throw new InternalFailureError({ message: 'Failed to create device activation.' });
  }

  if (!activationId || !activationCode) {
    logger.error('SSM CreateActivation returned no activation details', {
      action: 'DEVICE_ACTIVATION_FAILURE',
      deviceType,
    });
    recordActivationFailure();
    throw new InternalFailureError({ message: 'Failed to create device activation.' });
  }

  // Never log activationCode — it is a short-lived registration secret (@sensitive).
  logger.info('Device activation created', { action: 'DEVICE_ACTIVATION', deviceType, fleetId, activationId });

  return { activationId, activationCode, region, expiresAt } satisfies ActivateDeviceServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getActivateDeviceHandler(instrumentOperation(ActivateDeviceOperation)),
);
