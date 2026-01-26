// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand, SendMessageCommandInput } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import { JobType, leaderboardDao, modelDao, ResourceId, submissionDao } from '@deepracer-indy/database';
import {
  getCreateSubmissionHandler,
  CreateSubmissionServerInput,
  CreateSubmissionServerOutput,
  BadRequestError,
  ModelStatus,
  JobStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger, waitForAll } from '@deepracer-indy/utils';

import { sqsClient } from '../../utils/clients/sqsClient.js';
import type { WorkflowContext } from '../../workflow/types/workflowContext.js';
import { DEFAULT_GROUP_MESSAGE_ID } from '../constants/sqs.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** This is the implementation of business logic of the CreateSubmission operation. */
export const CreateSubmissionOperation: Operation<
  CreateSubmissionServerInput,
  CreateSubmissionServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  const leaderboardId = input.leaderboardId as ResourceId;
  const modelId = input.modelId as ResourceId;

  const [modelItem, leaderboardItem] = await waitForAll([
    modelDao.load({ modelId, profileId }),
    leaderboardDao.load({ leaderboardId }),
  ]);

  // Validate model exists and is in READY state
  if (modelItem.status !== ModelStatus.READY) {
    throw new BadRequestError({ message: 'Model is not in a submittable state.' });
  }

  // Validate leaderboard is OPEN and max submissions has not been reached
  const currentTime = new Date();
  const openTime = new Date(leaderboardItem.openTime);
  const closeTime = new Date(leaderboardItem.closeTime);

  if (currentTime < openTime || currentTime > closeTime) {
    throw new BadRequestError({ message: 'The leaderboard is not accepting submissions.' });
  }

  const { data: submissionItems } = await submissionDao.listByCreatedAt({ profileId, leaderboardId, maxResults: 1 });
  const numPreviousSubmissions = submissionItems[0]?.submissionNumber || 0;

  if (numPreviousSubmissions >= leaderboardItem.maxSubmissionsPerUser) {
    throw new BadRequestError({ message: 'Max number of submissions has been reached.' });
  }

  const [submissionItem] = await waitForAll([
    submissionDao.create({
      profileId,
      modelId: modelItem.modelId,
      modelName: modelItem.name,
      status: JobStatus.QUEUED,
      objectAvoidanceConfig: leaderboardItem.objectAvoidanceConfig,
      resettingBehaviorConfig: leaderboardItem.resettingBehaviorConfig,
      raceType: leaderboardItem.raceType,
      terminationConditions: {
        maxLaps: leaderboardItem.submissionTerminationConditions.maxLaps,
        maxTimeInMinutes: leaderboardItem.submissionTerminationConditions.maxTimeInMinutes ?? 20, // TODO: Set default from config
      },
      trackConfig: leaderboardItem.trackConfig,
      leaderboardId: leaderboardItem.leaderboardId,
      submissionNumber: numPreviousSubmissions + 1,
    }),
    modelDao.update({ profileId, modelId }, { status: ModelStatus.QUEUED }),
  ]);

  const workflowInput: WorkflowContext<JobType.SUBMISSION> = {
    modelId,
    profileId,
    leaderboardId,
    jobName: submissionItem.name,
  };

  const sendMessageCommandInput: SendMessageCommandInput = {
    QueueUrl: process.env.WORKFLOW_JOB_QUEUE_URL,
    MessageBody: JSON.stringify(workflowInput),
    MessageGroupId: DEFAULT_GROUP_MESSAGE_ID,
    MessageDeduplicationId: submissionItem.name,
  };

  logger.info('Sending workflow SQS message', { workflowInput, sendMessageCommandInput });

  const sendMessageResponse = await sqsClient.send(new SendMessageCommand(sendMessageCommandInput));

  logger.info('Successfully added message to queue', { sendMessageResponse });

  metricsLogger.logCreateSubmission();

  return {
    submissionId: submissionItem.submissionId,
  } satisfies CreateSubmissionServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getCreateSubmissionHandler(instrumentOperation(CreateSubmissionOperation)),
);
