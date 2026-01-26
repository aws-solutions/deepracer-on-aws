// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand, SendMessageCommandInput } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import {
  evaluationDao,
  JobType,
  modelDao,
  ResourceId,
  accountResourceUsageDao,
  profileDao,
} from '@deepracer-indy/database';
import {
  getCreateEvaluationHandler,
  CreateEvaluationServerInput,
  CreateEvaluationServerOutput,
  BadRequestError,
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
import {
  validateTerminationConditions,
  validateObjectAvoidanceConfig,
  validateTrackConfig,
  validateRacerComputeLimits,
} from '../utils/validation.js';

/** This is the implementation of business logic of the CreateEvaluation operation. */
export const CreateEvaluationOperation: Operation<
  CreateEvaluationServerInput,
  CreateEvaluationServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  const { evaluationConfig } = input;
  const modelId = input.modelId as ResourceId;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const accountResourceUsageItem = await accountResourceUsageDao.getOrCreate(currentYear, currentMonth);
  const accountComputeMinutesQueued = accountResourceUsageItem.accountComputeMinutesQueued;

  validateTrackConfig(evaluationConfig.trackConfig);
  validateTerminationConditions(evaluationConfig.maxTimeInMinutes);

  if (evaluationConfig.raceType === RaceType.OBJECT_AVOIDANCE) {
    validateObjectAvoidanceConfig(evaluationConfig?.objectAvoidanceConfig);
  }

  const modelItem = await modelDao.load({ modelId, profileId });

  if (modelItem.status !== ModelStatus.READY) {
    throw new BadRequestError({ message: 'Model is not ready for evaluation.' });
  }

  const profileQuotaUsage = await usageQuotaHelper.loadProfileComputeUsage(profileId);
  validateRacerComputeLimits(profileQuotaUsage, evaluationConfig.maxTimeInMinutes);

  const [evaluationItem] = await waitForAll([
    evaluationDao.create({
      profileId,
      modelId: modelItem.modelId,
      evaluationName: evaluationConfig.evaluationName,
      objectAvoidanceConfig:
        evaluationConfig.raceType === RaceType.OBJECT_AVOIDANCE ? evaluationConfig.objectAvoidanceConfig : undefined,
      raceType: evaluationConfig.raceType,
      resettingBehaviorConfig: evaluationConfig.resettingBehaviorConfig,
      status: JobStatus.QUEUED,
      terminationConditions: {
        maxLaps: evaluationConfig.maxLaps,
        maxTimeInMinutes: evaluationConfig.maxTimeInMinutes,
      },
      trackConfig: evaluationConfig.trackConfig,
    }),
    modelDao.update({ profileId, modelId }, { status: ModelStatus.QUEUED }),
    accountResourceUsageDao.update(
      { year: currentYear, month: currentMonth },
      { accountComputeMinutesQueued: accountComputeMinutesQueued + evaluationConfig.maxTimeInMinutes },
    ),
    profileDao.update(
      { profileId },
      { computeMinutesQueued: profileQuotaUsage.computeMinutesQueued + evaluationConfig.maxTimeInMinutes },
    ),
  ]);

  const workflowInput: WorkflowContext<JobType.EVALUATION> = {
    modelId,
    profileId,
    jobName: evaluationItem.name,
  };

  const sendMessageCommandInput: SendMessageCommandInput = {
    QueueUrl: process.env.WORKFLOW_JOB_QUEUE_URL,
    MessageBody: JSON.stringify(workflowInput),
    MessageGroupId: DEFAULT_GROUP_MESSAGE_ID,
    MessageDeduplicationId: evaluationItem.name,
  };

  logger.info('Sending workflow SQS message', { workflowInput, sendMessageCommandInput });

  const sendMessageResponse = await sqsClient.send(new SendMessageCommand(sendMessageCommandInput));

  logger.info('Successfully added message to queue', { sendMessageResponse });

  metricsLogger.logCreateEvaluation();

  return {
    evaluationId: evaluationItem.evaluationId,
  } satisfies CreateEvaluationServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getCreateEvaluationHandler(instrumentOperation(CreateEvaluationOperation)),
);
