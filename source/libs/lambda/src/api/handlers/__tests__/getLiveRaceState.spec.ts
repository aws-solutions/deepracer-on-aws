// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  rankingDao,
  submissionDao,
  LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEMS,
  TEST_RANKING_ITEMS,
} from '@deepracer-indy/database';
import { BadRequestError, LiveEventStatus, LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetLiveRaceStateOperation } from '../getLiveRaceState.js';

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  autoLaunchEnabled: true,
  submissionPeriodOpen: false,
};

describe('GetLiveRaceState', () => {
  beforeEach(() => {
    vi.spyOn(submissionDao, 'get').mockResolvedValue(undefined as never);
  });

  it('should return full race state snapshot', async () => {
    const queueItems = [
      { ...TEST_LIVE_QUEUE_ITEMS[0], status: LiveQueueItemStatus.COMPLETED },
      { ...TEST_LIVE_QUEUE_ITEMS[1], status: LiveQueueItemStatus.IN_PROGRESS },
      { ...TEST_LIVE_QUEUE_ITEMS[2], status: LiveQueueItemStatus.PENDING },
    ];

    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue(queueItems);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [TEST_RANKING_ITEMS[0]], cursor: null });

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.race.liveEventStatus).toEqual(LiveEventStatus.IN_PROGRESS);
    expect(result.race.autoLaunchEnabled).toEqual(true);
    expect(result.queue.totalModels).toEqual(3);
    expect(result.queue.completedModels).toEqual(1);
    expect(result.queue.pendingModels).toEqual(1);
    expect(result.queue.inProgressModels).toEqual(1);
    expect(result.currentEvaluation).toBeDefined();
    expect(result.currentEvaluation?.submissionId).toEqual(queueItems[1].submissionId);
    expect(result.rankings).toHaveLength(1);
    expect(result.rankings[0].rank).toEqual(1);
    expect(result.rankings[0].avatar).toEqual(TEST_RANKING_ITEMS[0].userProfile.avatar);
    expect(result.winner).toBeUndefined();
  });

  it('should return winner info when declared', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
      winnerId: TEST_LIVE_QUEUE_ITEMS[0].submissionId,
      winnerDeclaredAt: '2024-01-15T18:30:00Z',
    });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winner).toBeDefined();
    expect(result.winner?.submissionId).toEqual(TEST_LIVE_QUEUE_ITEMS[0].submissionId);
  });

  it('should return no currentEvaluation when nothing in progress', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([
      { ...TEST_LIVE_QUEUE_ITEMS[0], status: LiveQueueItemStatus.PENDING },
    ]);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.currentEvaluation).toBeUndefined();
    expect(result.queue.inProgressModels).toEqual(0);
  });

  it('should use defaults when live fields are undefined', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: undefined,
      autoLaunchEnabled: undefined,
      submissionPeriodOpen: undefined,
    });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.race.liveEventStatus).toEqual(LiveEventStatus.SCHEDULED);
    expect(result.race.autoLaunchEnabled).toEqual(false);
    expect(result.race.submissionPeriodOpen).toEqual(false);
  });

  it('should return winnerDeclaredAt as Date', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      winnerId: TEST_LIVE_QUEUE_ITEMS[0].submissionId,
      winnerDeclaredAt: '2024-01-15T18:30:00Z',
    });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winner?.winnerDeclaredAt).toEqual(new Date('2024-01-15T18:30:00Z'));
  });

  it('should handle winner with undefined winnerDeclaredAt', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      winnerId: TEST_LIVE_QUEUE_ITEMS[0].submissionId,
      winnerDeclaredAt: undefined,
    });
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue([]);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.winner).toBeDefined();
    expect(result.winner?.submissionId).toEqual(TEST_LIVE_QUEUE_ITEMS[0].submissionId);
  });

  it('should throw if not a live race', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Not a live race.' }));
  });

  it('should include streamUrl from submission when currentEvaluation is IN_PROGRESS', async () => {
    const queueItems = [{ ...TEST_LIVE_QUEUE_ITEMS[0], status: LiveQueueItemStatus.IN_PROGRESS }];
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue(queueItems);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(submissionDao, 'get').mockResolvedValue({
      videoStreamUrl: 'https://kvs.example.com/stream.m3u8',
    } as never);

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.currentEvaluation?.streamUrl).toEqual('https://kvs.example.com/stream.m3u8');
  });

  it('should return undefined streamUrl when submission lookup fails', async () => {
    const queueItems = [{ ...TEST_LIVE_QUEUE_ITEMS[0], status: LiveQueueItemStatus.IN_PROGRESS }];
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getQueue').mockResolvedValue(queueItems);
    vi.spyOn(rankingDao, 'listByRank').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(submissionDao, 'get').mockRejectedValue(new Error('DDB error'));

    const result = await GetLiveRaceStateOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.currentEvaluation?.streamUrl).toBeUndefined();
  });
});
