// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { liveQueueItemDao, TEST_LEADERBOARD_ID, TEST_LIVE_QUEUE_ITEMS } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '#api/constants/testConstants.js';

import { ListLiveQueueItemsOperation } from '../listLiveQueueItems.js';

describe('ListLiveQueueItems Operation', () => {
  it('should return a list of liveQueueItems for a given leaderboardId', async () => {
    expect.assertions(29);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue(TEST_LIVE_QUEUE_ITEMS);
    const output = await ListLiveQueueItemsOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(output.items).toBeDefined();
    expect(output.items.length).toBe(TEST_LIVE_QUEUE_ITEMS.length);
    output.items.forEach((lqi, idx) => {
      expect(lqi.leaderboardId).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].leaderboardId);
      expect(lqi.submissionId).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].submissionId);
      expect(lqi.queuePosition).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].queuePosition);
      expect(lqi.profileId).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].profileId);
      expect(lqi.modelName).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].modelName);
      expect(lqi.participantName).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].participantName);
      expect(lqi.status).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].status);
      expect(lqi.resetCount).toEqual(TEST_LIVE_QUEUE_ITEMS[idx].resetCount);
      expect(lqi.submittedAt).toEqual(new Date(TEST_LIVE_QUEUE_ITEMS[idx].submittedAt));
    });
  });

  it('should return an empty array if no items exist', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    const output = await ListLiveQueueItemsOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(output.items).toEqual([]);
    expect(output.items.length).toBe(0);
  });

  it('should throw an error if getQueue fails', async () => {
    vi.spyOn(liveQueueItemDao, 'getQueue').mockRejectedValue(new InternalFailureError({ message: 'Database error' }));

    await expect(
      ListLiveQueueItemsOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Database error' }));
  });
});
