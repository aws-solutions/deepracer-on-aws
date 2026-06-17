// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import {
  leaderboardDao,
  liveQueueItemDao,
  type LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
} from '@deepracer-indy/database';
import { BadRequestError, ConflictError, LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { LaunchLiveRaceOperation } from '../launchLiveRace.js';

const TEST_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:LiveRaceWorkflow';
const TEST_EXECUTION_ARN = 'arn:aws:states:us-east-1:123456789012:execution:LiveRaceWorkflow:live-race-test';

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.SCHEDULED,
  liveEventTime: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
  submissionPeriodOpen: false,
  currentExecutionArn: '',
  autoLaunchEnabled: false,
};

const mockSfnClient = mockClient(SFNClient);

describe('LaunchLiveRace', () => {
  beforeEach(() => {
    process.env.LIVE_RACE_STATE_MACHINE_ARN = TEST_STATE_MACHINE_ARN;
    mockSfnClient.reset();
    mockSfnClient.on(StartExecutionCommand).resolves({ executionArn: TEST_EXECUTION_ARN });
  });

  it('should launch a live race successfully', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({} as LeaderboardItem);

    const result = await LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.executionArn).toBe(TEST_EXECUTION_ARN);
    expect(result.liveEventStatus).toBe(LiveEventStatus.IN_PROGRESS);
    expect(leaderboardDao.acquireExecutionLock).toHaveBeenCalledWith(
      TEST_LEADERBOARD_ID,
      expect.stringContaining('pending:live-race-'),
    );
    expect(mockSfnClient.calls()).toHaveLength(1);
    expect(leaderboardDao.partialUpdate).toHaveBeenCalledWith(
      { leaderboardId: TEST_LEADERBOARD_ID },
      { currentExecutionArn: TEST_EXECUTION_ARN },
    );
  });

  it('should throw ConflictError if lock acquisition fails (concurrent request)', async () => {
    const condError = new Error('The conditional request failed');
    condError.name = 'ConditionalCheckFailedException';
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockRejectedValue(condError);

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Evaluation already in progress.' }));

    // Should NOT have started an execution
    expect(mockSfnClient.calls()).toHaveLength(0);
  });

  it('should rethrow non-conditional errors from lock acquisition', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockRejectedValue(new Error('DynamoDB throttled'));

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('DynamoDB throttled');

    expect(mockSfnClient.calls()).toHaveLength(0);
  });

  it('should throw ConflictError if lock acquisition fails via err.cause.name', async () => {
    const wrappedError = Object.assign(new Error('wrapped'), {
      cause: { name: 'ConditionalCheckFailedException' },
    });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockRejectedValue(wrappedError);

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Evaluation already in progress.' }));
  });

  it('should throw ConflictError if lock acquisition fails via message includes conditional', async () => {
    const msgError = new Error('The conditional request failed');
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockRejectedValue(msgError);

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Evaluation already in progress.' }));
  });

  it('should release lock if Step Functions start fails', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    const clearLockSpy = vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    mockSfnClient.on(StartExecutionCommand).rejects(new Error('SF start failed'));

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('SF start failed');

    expect(clearLockSpy).toHaveBeenCalledWith(TEST_LEADERBOARD_ID, expect.stringContaining('pending:live-race-'));
  });

  it('should throw BadRequestError if not a live race', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Not a live race.' }));
  });

  it('should throw BadRequestError if race already completed', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
    });

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Race already completed.' }));
  });

  it('should throw ConflictError if execution already running', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      currentExecutionArn: 'arn:aws:states:us-east-1:123:execution:existing',
    });

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'Evaluation already in progress.' }));
  });

  it('should throw BadRequestError if submissions still open when SCHEDULED', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      submissionPeriodOpen: true,
    });

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Must close submissions before starting.' }));
  });

  it('should throw BadRequestError if current time is before scheduled event time', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventTime: new Date(Date.now() + 3_600_000).toISOString(),
    });

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot start before scheduled time.' }));
  });

  it('should throw BadRequestError if no pending items in queue', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(null);

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'No pending items in queue.' }));
  });

  it('should throw NotFoundError if leaderboard does not exist', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should allow launch when status is IN_PROGRESS and no execution running', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      currentExecutionArn: '',
    });
    vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({} as LeaderboardItem);

    const result = await LaunchLiveRaceOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result.executionArn).toBe(TEST_EXECUTION_ARN);
    expect(result.liveEventStatus).toBe(LiveEventStatus.IN_PROGRESS);
  });
});
