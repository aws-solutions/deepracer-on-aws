// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  jobNameHelper,
  liveQueueItemDao,
  submissionDao,
  type JobName,
  TEST_LEADERBOARD_ID,
  TEST_LIVE_QUEUE_ITEM,
  TEST_PROFILE_ID_1,
  TEST_SUBMISSION_ID_1,
  TEST_SUBMISSION_ITEM,
} from '@deepracer-indy/database';
import { LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';

import { lookupInProgressSageMakerJob } from '../lookupInProgressSageMakerJob.js';

const IN_PROGRESS_ITEM = { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.IN_PROGRESS };
const TEST_JOB_NAME = 'deepracerindy-submission-abc-live-a1b2c3d4' as JobName;

describe('lookupInProgressSageMakerJob', () => {
  beforeEach(() => {
    vi.spyOn(submissionDao, 'get').mockResolvedValue(TEST_SUBMISSION_ITEM as never);
    vi.spyOn(jobNameHelper, 'getLiveJobNameFromArn').mockReturnValue(TEST_JOB_NAME);
  });

  it('returns job name when IN_PROGRESS item matches with submissionId', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([IN_PROGRESS_ITEM]);

    const result = await lookupInProgressSageMakerJob({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_1,
    });

    expect(result).toBe(TEST_JOB_NAME);
    expect(submissionDao.get).toHaveBeenCalledWith({
      profileId: TEST_PROFILE_ID_1,
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_1,
    });
  });

  it('returns job name when IN_PROGRESS item matches without submissionId', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([IN_PROGRESS_ITEM]);

    const result = await lookupInProgressSageMakerJob({ leaderboardId: TEST_LEADERBOARD_ID });

    expect(result).toBe(TEST_JOB_NAME);
  });

  it('returns undefined when no IN_PROGRESS item in queue', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([
      { ...TEST_LIVE_QUEUE_ITEM, status: LiveQueueItemStatus.PENDING },
    ]);

    const result = await lookupInProgressSageMakerJob({ leaderboardId: TEST_LEADERBOARD_ID });

    expect(result).toBeUndefined();
    expect(submissionDao.get).not.toHaveBeenCalled();
  });

  it('returns undefined when submissionId does not match the IN_PROGRESS item', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([IN_PROGRESS_ITEM]);

    const result = await lookupInProgressSageMakerJob({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: 'differentSubmissionId' as never,
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when submission has no sageMakerJobArn', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([IN_PROGRESS_ITEM]);
    vi.spyOn(submissionDao, 'get').mockResolvedValue({ ...TEST_SUBMISSION_ITEM, sageMakerJobArn: undefined } as never);

    const result = await lookupInProgressSageMakerJob({ leaderboardId: TEST_LEADERBOARD_ID });

    expect(result).toBeUndefined();
    expect(jobNameHelper.getLiveJobNameFromArn).not.toHaveBeenCalled();
  });

  it('returns undefined when getQueue throws', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockRejectedValue(new Error('DynamoDB error'));

    const result = await lookupInProgressSageMakerJob({ leaderboardId: TEST_LEADERBOARD_ID });

    expect(result).toBeUndefined();
  });

  it('returns undefined when submissionDao.get throws', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([IN_PROGRESS_ITEM]);
    vi.spyOn(submissionDao, 'get').mockRejectedValue(new Error('DynamoDB error'));

    const result = await lookupInProgressSageMakerJob({ leaderboardId: TEST_LEADERBOARD_ID });

    expect(result).toBeUndefined();
  });
});
