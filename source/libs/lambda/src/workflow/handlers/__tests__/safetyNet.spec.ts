// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
} from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';

import { safetyNet } from '../safetyNet.js';

const makeEvent = (status: string) => ({
  detail: {
    executionArn: 'arn:aws:states:exec:finished',
    stateMachineArn: 'arn:aws:states:sm:LiveRace',
    status,
    input: JSON.stringify({ leaderboardId: TEST_LEADERBOARD_ID }),
  },
});

describe('safetyNet', () => {
  it('should touch PENDING item when lock already cleared (happy path)', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockRejectedValue(
      Object.assign(new Error('conditional request failed'), { name: 'ConditionalCheckFailedException' }),
    );
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      currentExecutionArn: '',
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
    });
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    const touchSpy = vi.spyOn(liveQueueItemDao, 'touchItem').mockResolvedValue({} as never);

    await safetyNet.handler(makeEvent('SUCCEEDED'));

    expect(touchSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_LIVE_QUEUE_ITEM.submissionId,
    });
  });

  it('should rethrow unexpected errors from clearExecutionLock', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockRejectedValue(new Error('DynamoDB throttling'));

    await expect(safetyNet.handler(makeEvent('SUCCEEDED'))).rejects.toThrow('DynamoDB throttling');
  });

  it('should exit when new SF already running', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockRejectedValue(
      Object.assign(new Error('conditional request failed'), { name: 'ConditionalCheckFailedException' }),
    );
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      currentExecutionArn: 'arn:aws:states:exec:new-one',
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
    });
    const getNextSpy = vi.spyOn(liveQueueItemDao, 'getNextPending');

    await safetyNet.handler(makeEvent('SUCCEEDED'));

    expect(getNextSpy).not.toHaveBeenCalled();
  });

  it('should exit when race is COMPLETED', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      currentExecutionArn: '',
      liveEventStatus: LiveEventStatus.COMPLETED,
    });
    const getNextSpy = vi.spyOn(liveQueueItemDao, 'getNextPending');

    await safetyNet.handler(makeEvent('SUCCEEDED'));

    expect(getNextSpy).not.toHaveBeenCalled();
  });

  it('should backoff on repeated SF failures', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      currentExecutionArn: '',
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      lastSFFailureAt: Date.now() - 10_000,
    });
    const getNextSpy = vi.spyOn(liveQueueItemDao, 'getNextPending');

    await safetyNet.handler(makeEvent('FAILED'));

    expect(getNextSpy).not.toHaveBeenCalled();
  });

  it('should do nothing when no PENDING items', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      currentExecutionArn: '',
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
    });
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(null);
    const touchSpy = vi.spyOn(liveQueueItemDao, 'touchItem');

    await safetyNet.handler(makeEvent('SUCCEEDED'));

    expect(touchSpy).not.toHaveBeenCalled();
  });

  it('should record failure timestamp and continue to touch on first SF failure', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      currentExecutionArn: '',
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      lastSFFailureAt: undefined,
    });
    const updateSpy = vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({} as never);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    const touchSpy = vi.spyOn(liveQueueItemDao, 'touchItem').mockResolvedValue({} as never);

    await safetyNet.handler(makeEvent('FAILED'));

    expect(updateSpy).toHaveBeenCalledWith(
      { leaderboardId: TEST_LEADERBOARD_ID },
      expect.objectContaining({ lastSFFailureAt: expect.any(Number) }),
    );
    expect(touchSpy).toHaveBeenCalled();
  });
});
