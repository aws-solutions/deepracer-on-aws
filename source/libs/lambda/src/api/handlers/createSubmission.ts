// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand, SendMessageCommandInput } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import {
  JobType,
  leaderboardDao,
  liveQueueItemDao,
  modelDao,
  profileDao,
  ResourceId,
  submissionDao,
} from '@deepracer-indy/database';
import {
  getCreateSubmissionHandler,
  CreateSubmissionServerInput,
  CreateSubmissionServerOutput,
  BadRequestError,
  ModelStatus,
  JobStatus,
  LiveEventStatus,
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

  if (leaderboardItem.isLive) {
    return handleLiveRaceSubmission(leaderboardItem, modelItem, profileId, leaderboardId, modelId);
  }

  return handleCommunityRaceSubmission(leaderboardItem, modelItem, profileId, leaderboardId, modelId);
};

async function handleLiveRaceSubmission(
  leaderboardItem: Awaited<ReturnType<typeof leaderboardDao.load>>,
  modelItem: Awaited<ReturnType<typeof modelDao.load>>,
  profileId: ResourceId,
  leaderboardId: ResourceId,
  modelId: ResourceId,
): Promise<CreateSubmissionServerOutput> {
  // Validate submission period: before liveEventTime always accepted,
  // after liveEventTime rejected unless submissionPeriodOpen = true
  if (leaderboardItem.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Submissions closed.' });
  }

  const currentTime = new Date();
  const liveEventTime = leaderboardItem.liveEventTime ? new Date(leaderboardItem.liveEventTime) : null;

  if (liveEventTime && currentTime >= liveEventTime && !leaderboardItem.submissionPeriodOpen) {
    throw new BadRequestError({ message: 'Submissions closed.' });
  }

  // Live races: one submission per model (prevent re-submission of same model)
  const existingQueueItems = await liveQueueItemDao.getQueue({ leaderboardId });
  const alreadySubmitted = existingQueueItems.some((item) => item.modelId === modelId);
  if (alreadySubmitted) {
    throw new BadRequestError({ message: 'This model has already been submitted to this race.' });
  }

  const { data: submissionItems } = await submissionDao.listByCreatedAt({ profileId, leaderboardId, maxResults: 1 });
  const numPreviousSubmissions = submissionItems[0]?.submissionNumber || 0;

  if (numPreviousSubmissions >= leaderboardItem.maxSubmissionsPerUser) {
    throw new BadRequestError({ message: 'Max number of submissions has been reached.' });
  }

  const profileItem = await profileDao.load({ profileId });

  // Atomic write: Submission + LiveQueueItem via DynamoDB transaction
  const liveQueueItem = await liveQueueItemDao.addToQueue({
    profileId,
    modelId: modelItem.modelId,
    modelName: modelItem.name,
    participantName: profileItem.alias,
    status: JobStatus.QUEUED,
    objectAvoidanceConfig: leaderboardItem.objectAvoidanceConfig,
    resettingBehaviorConfig: leaderboardItem.resettingBehaviorConfig,
    raceType: leaderboardItem.raceType,
    terminationConditions: {
      maxLaps: leaderboardItem.submissionTerminationConditions.maxLaps,
      maxTimeInMinutes: leaderboardItem.submissionTerminationConditions.maxTimeInMinutes ?? 20,
    },
    trackConfig: leaderboardItem.trackConfig,
    leaderboardId: leaderboardItem.leaderboardId,
    submissionNumber: numPreviousSubmissions + 1,
  });

  await modelDao.update({ profileId, modelId }, { status: ModelStatus.QUEUED });

  metricsLogger.logCreateSubmission({ isLive: true, profileId, leaderboardId });

  return { submissionId: liveQueueItem.submissionId } satisfies CreateSubmissionServerOutput;
}

async function handleCommunityRaceSubmission(
  leaderboardItem: Awaited<ReturnType<typeof leaderboardDao.load>>,
  modelItem: Awaited<ReturnType<typeof modelDao.load>>,
  profileId: ResourceId,
  leaderboardId: ResourceId,
  modelId: ResourceId,
): Promise<CreateSubmissionServerOutput> {
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
        maxTimeInMinutes: leaderboardItem.submissionTerminationConditions.maxTimeInMinutes ?? 20,
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

  metricsLogger.logCreateSubmission({ isLive: false, profileId, leaderboardId });

  return { submissionId: submissionItem.submissionId } satisfies CreateSubmissionServerOutput;
}

export const lambdaHandler = getApiGatewayHandler(
  getCreateSubmissionHandler(instrumentOperation(CreateSubmissionOperation)),
);
