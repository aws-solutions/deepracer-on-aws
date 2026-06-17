// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  liveQueueItemDao,
  TEST_LEADERBOARD_ID,
  TEST_LIVE_QUEUE_ITEM,
  TEST_SUBMISSION_ID_1,
} from '@deepracer-indy/database';
import { LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';

import type { LiveRaceContext } from '../../types/liveRaceContext.js';
import { updateQueueStatus } from '../updateQueueStatus.js';

const baseContext: LiveRaceContext = {
  leaderboardId: TEST_LEADERBOARD_ID,
  modelsProcessed: 0,
  currentSubmissionId: TEST_SUBMISSION_ID_1,
};

describe('updateQueueStatus', () => {
  it('should update status with conditional write', async () => {
    const spy = vi.spyOn(liveQueueItemDao, 'updateStatus').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);

    await updateQueueStatus.handler({
      context: baseContext,
      status: LiveQueueItemStatus.IN_PROGRESS,
      expectedStatus: LiveQueueItemStatus.PENDING,
    });

    expect(spy).toHaveBeenCalledWith({
      leaderboardId: baseContext.leaderboardId,
      submissionId: baseContext.currentSubmissionId,
      status: LiveQueueItemStatus.IN_PROGRESS,
      expectedStatus: LiveQueueItemStatus.PENDING,
    });
  });

  it('should swallow conditional check failure as expected race condition', async () => {
    const condError = new Error('The conditional request failed');
    condError.name = 'ConditionalCheckFailedException';
    vi.spyOn(liveQueueItemDao, 'updateStatus').mockRejectedValue(condError);

    const result = await updateQueueStatus.handler({
      context: baseContext,
      status: LiveQueueItemStatus.COMPLETED,
      expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
    });

    expect(result).toEqual(baseContext);
  });

  it('should propagate unexpected errors', async () => {
    vi.spyOn(liveQueueItemDao, 'updateStatus').mockRejectedValue(new Error('DynamoDB throttled'));

    await expect(
      updateQueueStatus.handler({
        context: baseContext,
        status: LiveQueueItemStatus.FAILED,
        expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow('DynamoDB throttled');
  });

  it('should throw if currentSubmissionId is missing', async () => {
    await expect(
      updateQueueStatus.handler({
        // @ts-expect-error - testing runtime validation with invalid input
        context: { ...baseContext, currentSubmissionId: '' },
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      }),
    ).rejects.toThrow('currentSubmissionId is required');
  });
});
