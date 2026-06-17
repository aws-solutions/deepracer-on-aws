// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { leaderboardDao, TEST_LEADERBOARD_ID, TEST_LEADERBOARD_ITEM } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import type { DynamoDBStreamEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';

import { streamHandler } from '../streamHandler.js';

const sfnMock = mockClient(SFNClient);

const makeEvent = (pk: string, eventName: 'INSERT' | 'MODIFY' = 'INSERT'): DynamoDBStreamEvent => ({
  Records: [
    {
      eventName,
      dynamodb: {
        Keys: { pk: { S: pk } },
      },
    },
  ],
});

describe('streamHandler', () => {
  beforeEach(() => {
    sfnMock.reset();
    process.env.LIVE_RACE_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123:stateMachine:LiveRace';
  });

  it('should start SF when all preconditions met', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({} as never);
    sfnMock.on(StartExecutionCommand).resolves({ executionArn: 'arn:aws:states:exec:123' });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(leaderboardDao.acquireExecutionLock).toHaveBeenCalled();
    expect(sfnMock.calls()).toHaveLength(1);
    expect(leaderboardDao.partialUpdate).toHaveBeenCalledWith(
      { leaderboardId: TEST_LEADERBOARD_ID },
      { currentExecutionArn: 'arn:aws:states:exec:123' },
    );
  });

  it('should no-op when not a live race', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: false,
    });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(sfnMock.calls()).toHaveLength(0);
  });

  it('should no-op when race not IN_PROGRESS', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.SCHEDULED,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(sfnMock.calls()).toHaveLength(0);
  });

  it('should no-op when autolaunch is disabled', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: false,
      currentExecutionArn: '',
    });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(sfnMock.calls()).toHaveLength(0);
  });

  it('should no-op when SF already running', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: 'arn:existing',
    });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(sfnMock.calls()).toHaveLength(0);
  });

  it('should skip non-livequeueitem records', async () => {
    const loadSpy = vi.spyOn(leaderboardDao, 'load');

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}`));

    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('should process MODIFY events (e.g. touchItem trigger)', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({} as never);
    sfnMock.on(StartExecutionCommand).resolves({ executionArn: 'arn:aws:states:exec:456' });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`, 'MODIFY'));

    expect(sfnMock.calls()).toHaveLength(1);
  });

  it('should skip when lock acquisition fails (concurrent handler)', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockRejectedValue(new Error('ConditionalCheckFailed'));

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(sfnMock.calls()).toHaveLength(0);
  });

  it('should clear lock on StartExecution failure', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    const clearSpy = vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    sfnMock.on(StartExecutionCommand).rejects(new Error('SF error'));

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(clearSpy).toHaveBeenCalledWith(TEST_LEADERBOARD_ID, expect.stringContaining('pending:live-race-'));
  });

  it('should log error when clearExecutionLock also fails after SF start failure', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockRejectedValue(new Error('DDB throttle'));
    sfnMock.on(StartExecutionCommand).rejects(new Error('SF error'));

    await expect(
      streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`)),
    ).resolves.not.toThrow();
  });

  it('should clear lock when StartExecution returns no executionArn', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    const clearSpy = vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    sfnMock.on(StartExecutionCommand).resolves({ executionArn: undefined });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(clearSpy).toHaveBeenCalled();
  });

  it('should not clear lock when partialUpdate fails after SF started', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: true,
      currentExecutionArn: '',
    });
    vi.spyOn(leaderboardDao, 'acquireExecutionLock').mockResolvedValue(undefined);
    vi.spyOn(leaderboardDao, 'partialUpdate').mockRejectedValue(new Error('DDB error'));
    const clearSpy = vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);
    sfnMock.on(StartExecutionCommand).resolves({ executionArn: 'arn:aws:states:exec:789' });

    await streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`));

    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('should continue processing when one leaderboard fails', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(new Error('DDB error'));

    await expect(
      streamHandler.handler(makeEvent(`leaderboard_${TEST_LEADERBOARD_ID}#livequeueitem`)),
    ).resolves.not.toThrow();
  });
});
