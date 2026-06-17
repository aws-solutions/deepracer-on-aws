// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { liveQueueItemDao, submissionDao, TEST_LIVE_QUEUE_ITEM, TEST_LEADERBOARD_ID } from '@deepracer-indy/database';

import type { LiveRaceContext } from '../../types/liveRaceContext.js';
import { getNextPending } from '../getNextPending.js';

const baseContext: LiveRaceContext = {
  leaderboardId: TEST_LEADERBOARD_ID,
  modelsProcessed: 0,
};

const TEST_SUBMISSION = {
  name: 'deepracerindy-sub-123',
  modelId: 'model-abc',
};

describe('getNextPending', () => {
  it('should return next pending item with jobName and modelId', async () => {
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(submissionDao, 'get').mockResolvedValue(TEST_SUBMISSION as never);

    const result = await getNextPending.handler(baseContext);

    expect(result.queueEmpty).toBe(false);
    expect(result.currentSubmissionId).toBe(TEST_LIVE_QUEUE_ITEM.submissionId);
    expect(result.profileId).toBe(TEST_LIVE_QUEUE_ITEM.profileId);
    expect(result.jobName).toMatch(new RegExp(`^${TEST_SUBMISSION.name}-live-[a-f0-9]{8}$`));
    expect(result.modelId).toBe(TEST_SUBMISSION.modelId);
  });

  it('should set queueEmpty when no pending items', async () => {
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(null);

    const result = await getNextPending.handler(baseContext);

    expect(result.queueEmpty).toBe(true);
    expect(result.currentSubmissionId).toBeUndefined();
  });

  it('should throw when submission not found for queue item', async () => {
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(submissionDao, 'get').mockResolvedValue(null);

    await expect(getNextPending.handler(baseContext)).rejects.toThrow(
      `Submission not found for submissionId=${TEST_LIVE_QUEUE_ITEM.submissionId}`,
    );
  });
});
