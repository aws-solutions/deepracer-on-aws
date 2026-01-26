// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand, SendMessageCommandInput } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import {
  generateResourceId,
  JobType,
  modelDao,
  ResourceId,
  trainingDao,
  accountResourceUsageDao,
  profileDao,
} from '@deepracer-indy/database';
import {
  getCreateModelHandler,
  CreateModelServerInput,
  CreateModelServerOutput,
  BadRequestError,
  AgentAlgorithm,
  ModelStatus,
  JobStatus,
  RaceType,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger, waitForAll } from '@deepracer-indy/utils';

import { sqsClient } from '../../utils/clients/sqsClient.js';
import { usageQuotaHelper } from '../../utils/UsageQuotaHelper.js';
import type { WorkflowContext } from '../../workflow/types/workflowContext.js';
import { DEFAULT_GROUP_MESSAGE_ID } from '../constants/sqs.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { rewardFunctionValidator } from '../utils/RewardFunctionValidator.js';
import {
  validateCarCustomization,
  validateContinuousActionSpace,
  validateObjectAvoidanceConfig,
  validateTerminationConditions,
  validateTrackConfig,
  validateRacerComputeLimits,
} from '../utils/validation.js';
import { validator } from '../utils/Validator.js';

/** This is the implementation of business logic of the CreateModel operation. */
export const CreateModelOperation: Operation<CreateModelServerInput, CreateModelServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;
  const { modelDefinition } = input;
  const preTrainedModelId = input.preTrainedModelId as ResourceId | undefined;
  const { trainingConfig, metadata: modelMetadata, name: modelName } = modelDefinition;

  validateTrackConfig(trainingConfig.trackConfig);
  validateCarCustomization(modelDefinition.carCustomization);
  validateTerminationConditions(trainingConfig.maxTimeInMinutes);

  if (trainingConfig.raceType === RaceType.OBJECT_AVOIDANCE) {
    validateObjectAvoidanceConfig(trainingConfig.objectAvoidanceConfig);
  }

  // Validate that action space and training algorithm are aligned
  if (modelMetadata.agentAlgorithm === AgentAlgorithm.SAC && modelMetadata.actionSpace.discrete) {
    throw new BadRequestError({ message: 'Agent algorithm SAC does not work with discrete action space.' });
  }
  if (
    modelMetadata.agentAlgorithm === AgentAlgorithm.SAC &&
    modelMetadata.hyperparameters.num_episodes_between_training !== 1
  ) {
    throw new BadRequestError({
      message: 'Invalid hyperparameter number of episodes between training for SAC agent algorithm.',
    });
  }
  if (modelMetadata.actionSpace.continous) {
    validateContinuousActionSpace(modelMetadata.actionSpace.continous);
  }

  if (preTrainedModelId) {
    await validator.validateCloneModel(profileId, preTrainedModelId, modelDefinition);
  }

  await rewardFunctionValidator.validateRewardFunction({
    rewardFunction: modelMetadata.rewardFunction,
    trackConfig: trainingConfig.trackConfig,
  });

  const profileQuotaUsage = await usageQuotaHelper.loadProfileComputeUsage(profileId);
  validateRacerComputeLimits(profileQuotaUsage, trainingConfig.maxTimeInMinutes, true);

  const modelId = generateResourceId();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const accountResourceUsageItem = await accountResourceUsageDao.getOrCreate(currentYear, currentMonth);
  const accountComputeMinutesQueued = accountResourceUsageItem.accountComputeMinutesQueued;

  const [modelItem, trainingItem] = await waitForAll([
    modelDao.create({
      modelId,
      profileId,
      clonedFromModelId: preTrainedModelId,
      carCustomization: modelDefinition.carCustomization,
      description: modelDefinition.description,
      metadata: modelMetadata,
      name: modelName,
      status: ModelStatus.QUEUED,
    }),
    trainingDao.create({
      modelId,
      profileId,
      objectAvoidanceConfig: trainingConfig.objectAvoidanceConfig,
      raceType: trainingConfig.raceType,
      status: JobStatus.QUEUED,
      terminationConditions: {
        maxTimeInMinutes: trainingConfig.maxTimeInMinutes,
      },
      trackConfig: trainingConfig.trackConfig,
    }),
    accountResourceUsageDao.update(
      { year: currentYear, month: currentMonth },
      { accountComputeMinutesQueued: accountComputeMinutesQueued + trainingConfig.maxTimeInMinutes },
    ),
    profileDao.update(
      { profileId },
      { computeMinutesQueued: profileQuotaUsage.computeMinutesQueued + trainingConfig.maxTimeInMinutes },
    ),
  ]);

  const workflowInput: WorkflowContext<JobType.TRAINING> = {
    modelId,
    profileId,
    jobName: trainingItem.name,
  };

  const sendMessageCommandInput: SendMessageCommandInput = {
    QueueUrl: process.env.WORKFLOW_JOB_QUEUE_URL,
    MessageBody: JSON.stringify(workflowInput),
    MessageGroupId: DEFAULT_GROUP_MESSAGE_ID,
    MessageDeduplicationId: trainingItem.name,
  };

  logger.info('Sending workflow SQS message', { workflowInput, sendMessageCommandInput });

  const sendMessageResponse = await sqsClient.send(new SendMessageCommand(sendMessageCommandInput));

  logger.info('Successfully added message to queue', { sendMessageResponse });

  metricsLogger.logCreateModel();

  return {
    modelId: modelItem.modelId,
  } satisfies CreateModelServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getCreateModelHandler(instrumentOperation(CreateModelOperation)));
