// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import { generateResourceId, modelDao, trainingDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  getImportModelHandler,
  ImportModelServerInput,
  ImportModelServerOutput,
  JobStatus,
  ModelStatus,
  RaceType,
} from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, logger, metricsLogger, waitForAll } from '@deepracer-indy/utils';

import { importHelper } from '../../import-workflow/utils/ImportHelper.js';
import { sqsClient } from '../../utils/clients/sqsClient.js';
import { ActionSpaceType, TrainingAlgorithm } from '../../workflow/constants/simulation.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import {
  validateCarCustomization,
  validateContinuousActionSpace,
  validateObjectAvoidanceConfig,
  validateTrackConfig,
} from '../utils/validation.js';

export const ImportModelOperation: Operation<ImportModelServerInput, ImportModelServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  validateRequest(input);

  const { modelName, modelDescription, s3Bucket, s3Path } = input;

  logger.info('Model import initiated', { modelName, modelDescription, s3Bucket, s3Path });

  const s3Location = `s3://${s3Bucket}/${s3Path}`;
  const profileId = context.profileId;

  // Parse and validate all model files
  const { trainingParams, modelMetadata, rewardFunction, hyperparameters } =
    await importHelper.parseImportedFiles(s3Location);

  // Validate car customization
  const carCustomization = importHelper.getCarCustomization(trainingParams);
  validateCarCustomization(carCustomization);

  // Validate track config
  const trackConfig = importHelper.getTrackConfig(trainingParams);
  validateTrackConfig(trackConfig);

  // Get track name with direction suffix for reward function validation
  const trackName = importHelper.getTrackNameForValidation(trackConfig);

  // Determine race type and validate object avoidance if needed
  const raceType = importHelper.determineRaceType(trainingParams);
  let objectAvoidanceConfig;
  if (raceType === RaceType.OBJECT_AVOIDANCE) {
    objectAvoidanceConfig = importHelper.parseObjectAvoidanceConfig(trainingParams);
    validateObjectAvoidanceConfig(objectAvoidanceConfig);
  }

  // Validate training algorithm and action space alignment
  const trainingAlgorithm = modelMetadata.training_algorithm;
  const actionSpaceType = modelMetadata.action_space_type;
  if (trainingAlgorithm === TrainingAlgorithm.SAC && actionSpaceType === ActionSpaceType.DISCRETE) {
    throw new BadRequestError({ message: 'Agent algorithm SAC does not work with discrete action space.' });
  }

  if (trainingAlgorithm === TrainingAlgorithm.SAC && hyperparameters.num_episodes_between_training !== 1) {
    throw new BadRequestError({
      message: 'Invalid hyperparameter number of episodes between training for SAC agent algorithm.',
    });
  }

  // Validate action space
  const actionSpace = importHelper.importActionSpace(modelMetadata);
  if (actionSpaceType === ActionSpaceType.CONTINUOUS && actionSpace?.continous) {
    validateContinuousActionSpace(actionSpace.continous);
  }

  const agentAlgorithm = importHelper.convertToAgentAlgorithm(modelMetadata.training_algorithm);
  const sensors = importHelper.importSensors(modelMetadata.sensor);
  const maxTimeInMinutes = 0;
  // Create model and training records with empty reward function (will be updated after validation)
  const modelId = generateResourceId();
  const [modelItem, trainingItem] = await waitForAll([
    modelDao.create({
      modelId,
      profileId,
      name: modelName,
      description: modelDescription,
      metadata: {
        rewardFunction: '',
        actionSpace,
        hyperparameters,
        agentAlgorithm,
        sensors,
      },
      carCustomization,
      status: ModelStatus.IMPORTING,
    }),
    trainingDao.create({
      modelId,
      profileId,
      objectAvoidanceConfig,
      raceType,
      status: JobStatus.COMPLETED,
      terminationConditions: {
        maxTimeInMinutes,
      },
      trackConfig,
    }),
  ]);

  logger.info('Model and training items created', {
    modelId: modelItem.modelId,
    profileId,
  });

  // Parse and copy metrics file as S3 location is not known until after the training item is created
  const metrics = await importHelper.parseMetrics(s3Location);
  if (metrics) {
    const metricsLocation = trainingItem.assetS3Locations.metricsS3Location;
    await importHelper.copyMetricsFile(s3Location, metricsLocation);
  }

  // Parse S3 location to extract bucket and prefix for model validation
  const s3Url = new AmazonS3URI(s3Location);
  const parsedS3Bucket = s3Url.bucket;
  const parsedS3Prefix = s3Url.key;

  const messageBody = JSON.stringify({
    s3Location,
    s3Bucket: parsedS3Bucket,
    s3Prefix: parsedS3Prefix,
    profileId,
    modelId,
    modelName,
    modelDescription,
    rewardFunction,
    trackConfig,
    trackName,
    awsRegion: process.env.AWS_REGION,
  });

  const command = new SendMessageCommand({
    QueueUrl: process.env.IMPORT_MODEL_JOB_QUEUE_URL,
    MessageBody: messageBody,
  });

  await sqsClient.send(command);

  metricsLogger.logImportModel();

  return {
    modelId,
  } satisfies ImportModelServerOutput;
};

export const validateRequest = (input: ImportModelServerInput) => {
  const { modelName, modelDescription, s3Bucket, s3Path } = input;
  // Model name, bucket, and path should be defined
  if (!modelName || !s3Bucket || !s3Path) {
    logger.error('Missing required fields for model import', { modelName, s3Bucket, s3Path });
    throw new BadRequestError({ message: 'Missing required fields' });
  }

  // Model name should match specified regex
  const modelNameRegex = /^[a-zA-Z0-9-]+$/;
  if (!modelNameRegex.test(modelName) || modelName.length > 64) {
    logger.error('Invalid modelName format', { modelName });
    throw new BadRequestError({
      message:
        'Model name must contain only alphanumeric characters and hyphens; and must be less than or equal to 64 characters in length',
    });
  }

  // Model description should match specified regex
  const modelDescRegex = /^[a-zA-Z0-9- ]+$/;
  if (modelDescription && (!modelDescRegex.test(modelDescription) || modelDescription.length > 255)) {
    logger.error('Invalid modelDescription format', { modelDescription });
    throw new BadRequestError({
      message:
        'Model description must contain only alphanumeric characters, spaces, and hyphen; and must be less than or equal to 255 characters in length',
    });
  }
};

export const lambdaHandler = getApiGatewayHandler(getImportModelHandler(instrumentOperation(ImportModelOperation)));
