// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  jobNameHelper,
  liveQueueItemDao,
  submissionDao,
  type JobName,
  type ResourceId,
} from '@deepracer-indy/database';
import { LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

/**
 * Looks up the SageMaker job name for the IN_PROGRESS item in the live queue.
 * If submissionId is provided, only matches that specific item.
 * Returns undefined if no matching item is found or if the lookup fails.
 */
export async function lookupInProgressSageMakerJob({
  leaderboardId,
  submissionId,
}: {
  leaderboardId: ResourceId;
  submissionId?: ResourceId;
}): Promise<JobName | undefined> {
  try {
    const queue = await liveQueueItemDao.getQueue({ leaderboardId });
    const inProgressItem = queue.find(
      (item) =>
        item.status === LiveQueueItemStatus.IN_PROGRESS && (submissionId == null || item.submissionId === submissionId),
    );
    if (!inProgressItem) return undefined;

    const submission = await submissionDao.get({
      profileId: inProgressItem.profileId,
      leaderboardId,
      submissionId: inProgressItem.submissionId,
    });
    if (!submission?.sageMakerJobArn) return undefined;

    return jobNameHelper.getLiveJobNameFromArn(submission.sageMakerJobArn);
  } catch (err) {
    logger.warn('Failed to look up SageMaker job', { leaderboardId, submissionId, err });
    return undefined;
  }
}
