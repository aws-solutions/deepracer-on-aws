// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { liveQueueItemDao, submissionDao } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { LiveRaceContext } from '../types/liveRaceContext.js';

/**
 * Fetches the first PENDING queue item by position.
 * Loads the submission to populate jobName and modelId for JobInitializer.
 * Signals queue empty if none found.
 */
const handler = async (context: LiveRaceContext): Promise<LiveRaceContext> => {
  logger.info('START GetNextPending', { context });

  const item = await liveQueueItemDao.getNextPending({ leaderboardId: context.leaderboardId });

  if (!item) {
    logger.info('No pending items in queue');
    return { ...context, queueEmpty: true, currentSubmissionId: undefined };
  }

  // Load submission to get jobName and modelId for JobInitializer
  const submission = await submissionDao.get({
    profileId: item.profileId,
    leaderboardId: context.leaderboardId,
    submissionId: item.submissionId,
  });

  if (!submission) {
    throw new Error(`Submission not found for submissionId=${item.submissionId}`);
  }

  // Generate unique job name for live race — SageMaker does not allow reusing training job names
  const jobName = `${submission.name}-live-${crypto.randomUUID().slice(0, 8)}`;

  logger.info('Found pending item', { submissionId: item.submissionId, jobName });

  return {
    ...context,
    queueEmpty: false,
    currentSubmissionId: item.submissionId,
    profileId: item.profileId,
    jobName,
    modelId: submission.modelId,
  };
};

export const getNextPending = { handler };
export const lambdaHandler = instrumentHandler(handler);
