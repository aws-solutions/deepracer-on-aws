// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import { DescribeInstanceInformationCommand } from '@aws-sdk/client-ssm';
import type { Operation } from '@aws-smithy/server-common';
import {
  deploymentDao,
  deviceDao,
  generateResourceId,
  modelDao,
  profileDao,
  ResourceId,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  CarType,
  DeploymentStatus,
  DeployModelServerInput,
  DeployModelServerOutput,
  getDeployModelHandler,
  InternalFailureError,
  NotAuthorizedError,
  OptimizationStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger, s3Helper } from '@deepracer-indy/utils';

import { sfnClient } from '#utils/clients/sfnClient.js';
import { ssmClient } from '#utils/clients/ssmClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Maps carType to the optimized artifact archive filename to deploy.
 * - DEEPRACER (stock, unmodified): pb-only, on-device conversion from model.pb
 * - DEEPRACER_CUSTOM (custom OS installed): openvino-model, pre-compiled IR v11
 * - DEEPRACER_RPI (Raspberry Pi build): rpi-model, TFLite
 */
const ARTIFACT_BY_CAR_TYPE: Record<CarType, string> = {
  [CarType.DEEPRACER]: 'pb-only-model.tar.gz',
  [CarType.DEEPRACER_CUSTOM]: 'openvino-model.tar.gz',
  [CarType.DEEPRACER_RPI]: 'rpi-model.tar.gz',
};

/**
 * Deploys an optimized model to a physical DeepRacer car via SSM.
 *
 * Validates preconditions: model is optimized, car is online (SSM PingStatus), carType is
 * configured, and no deployment is already active for this model+car. Generates a presigned
 * S3 URL for the correct artifact archive based on carType, creates a PENDING deployment
 * record, and starts the Push Step Function execution which delivers the model to the car.
 */
export const DeployModelOperation: Operation<DeployModelServerInput, DeployModelServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can deploy models to cars.' });
  }

  const modelId = input.modelId as ResourceId;
  const targetProfileId = input.profileId as ResourceId;
  const carInstanceId = input.carInstanceId;
  const eventId = input.eventId as ResourceId;
  const batchId = input.batchId as ResourceId | undefined;

  // Fetch model and device records in parallel
  const [model, device, targetProfile] = await Promise.all([
    modelDao.load({ modelId, profileId: targetProfileId }),
    deviceDao.load({ instanceId: carInstanceId }),
    profileDao.load({ profileId: targetProfileId }),
  ]);

  // Validate optimizationStatus is OPTIMIZED
  if (model.optimizationStatus !== OptimizationStatus.OPTIMIZED) {
    throw new BadRequestError({
      message: `Model must be optimized before deployment. Current optimization status: ${model.optimizationStatus ?? 'not started'}`,
    });
  }

  // Validate carType is set on the device
  if (!device.carType) {
    throw new BadRequestError({
      message: 'Car type is not configured on this device. Complete device setup before deploying.',
    });
  }

  // Check car is online via SSM
  const ssmResponse = await ssmClient.send(
    new DescribeInstanceInformationCommand({
      Filters: [{ Key: 'InstanceIds', Values: [carInstanceId] }],
    }),
  );
  const instanceInfo = ssmResponse.InstanceInformationList?.[0];
  if (instanceInfo?.PingStatus !== 'Online') {
    throw new BadRequestError({
      message: 'Car is offline. Ensure the car is powered on and connected before deploying.',
    });
  }

  // Check no IN_PROGRESS deployment for same model + car
  const existingDeployments = await deploymentDao.listAllByModel({ modelId });
  const hasActiveDeployment = existingDeployments.some(
    (d) => d.carInstanceId === carInstanceId && d.status === DeploymentStatus.IN_PROGRESS,
  );
  if (hasActiveDeployment) {
    throw new BadRequestError({
      message: 'A deployment is already in progress for this model and car.',
    });
  }

  // Generate presigned URL for the correct artifact
  const optimizedPrefix = model.optimizedArtifactsS3Prefix;
  if (!optimizedPrefix) {
    throw new BadRequestError({ message: 'Model optimization artifacts not found.' });
  }

  const artifactKey = `${optimizedPrefix}${ARTIFACT_BY_CAR_TYPE[device.carType as CarType]}`;
  const bucket = process.env.MODEL_DATA_BUCKET_NAME;
  if (!bucket) {
    logger.error('Missing required environment variable', { variable: 'MODEL_DATA_BUCKET_NAME' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }
  const stateMachineArn = process.env.PUSH_STATE_MACHINE_ARN;
  if (!stateMachineArn) {
    logger.error('Missing required environment variable', { variable: 'PUSH_STATE_MACHINE_ARN' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  const presignedUrl = await s3Helper.getPresignedUrl(`s3://${bucket}/${artifactKey}`, 600);

  // Create deployment record
  const deploymentId = generateResourceId() as ResourceId;
  await deploymentDao.create({
    modelId,
    deploymentId,
    profileId,
    carInstanceId,
    eventId,
    batchId,
    modelName: model.name,
    carName: device.name,
    fleetId: device.fleetId,
    status: DeploymentStatus.PENDING,
  });

  logger.info('Deployment created, starting step function', { deploymentId, modelId, carInstanceId });

  // Start Push Step Function execution
  try {
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: deploymentId,
        input: JSON.stringify({
          deploymentId,
          modelId,
          carInstanceId,
          presignedUrl,
          carType: device.carType,
          modelName: model.name,
          racerName: targetProfile.alias,
        }),
      }),
    );
  } catch (error) {
    try {
      await deploymentDao.updateStatus({
        modelId,
        deploymentId,
        status: DeploymentStatus.FAILED,
        expectedStatus: DeploymentStatus.PENDING,
        errorMessage: 'Failed to start deployment execution',
      });
    } catch (rollbackError) {
      logger.error('Failed to mark deployment as FAILED during rollback', { deploymentId, rollbackError });
    }
    throw error;
  }

  metricsLogger.logDeployModel();

  return {
    deploymentId,
    modelId,
    carInstanceId,
    status: DeploymentStatus.PENDING,
  } satisfies DeployModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getDeployModelHandler(instrumentOperation(DeployModelOperation)));
