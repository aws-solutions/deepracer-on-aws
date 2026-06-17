// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import { leaderboardDao, liveQueueItemDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-client';
import type { DynamoDBRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest';

import {
  parseRecord,
  buildEventsForLiveQueueItem,
  buildEventsForRanking,
  buildEventsForLeaderboard,
  buildEventsForSubmission,
  publishToIoT,
  handler,
} from '../liveBroadcastHandler.js';

vi.mock('@deepracer-indy/database', () => ({
  leaderboardDao: { get: vi.fn() },
  liveQueueItemDao: { getQueue: vi.fn() },
  rankingDao: { listByRank: vi.fn() },
}));

const mockIoTClient = mockClient(IoTDataPlaneClient);

const mockRankingDao = vi.mocked(rankingDao);
const mockLeaderboardDao = vi.mocked(leaderboardDao);

const makeDDBRecord = (
  pk: string,
  sk: string,
  eventName: 'INSERT' | 'MODIFY',
  newImage: Record<string, unknown>,
  oldImage?: Record<string, unknown>,
  sequenceNumber = '100000000000000000001',
): DynamoDBRecord => ({
  eventName,
  dynamodb: {
    SequenceNumber: sequenceNumber,
    NewImage: { pk: { S: pk }, sk: { S: sk }, ...newImage },
    ...(oldImage ? { OldImage: { pk: { S: pk }, sk: { S: sk }, ...oldImage } } : {}),
  },
});

describe('parseRecord', () => {
  it('parses LiveQueueItem from PK containing #livequeueitem', () => {
    const record = makeDDBRecord('leaderboard_lb1#livequeueitem', 'submission_sub1', 'INSERT', {
      status: { S: 'PENDING' },
    });
    const result = parseRecord(record);
    expect(result).toEqual(
      expect.objectContaining({ entityType: 'LiveQueueItem', leaderboardId: 'lb1', eventName: 'INSERT' }),
    );
  });

  it('parses Ranking from SK ending with #ranking', () => {
    const record = makeDDBRecord('leaderboard_lb1', 'profile_p1#ranking', 'MODIFY', {
      rankingScore: { N: '12000' },
    });
    const result = parseRecord(record);
    expect(result).toEqual(
      expect.objectContaining({ entityType: 'Ranking', leaderboardId: 'lb1', eventName: 'MODIFY' }),
    );
  });

  it('parses Leaderboard from PK=leaderboards and SK starting with leaderboard_', () => {
    const record = makeDDBRecord('leaderboards', 'leaderboard_lb1', 'MODIFY', {
      liveEventStatus: { S: 'IN_PROGRESS' },
    });
    const result = parseRecord(record);
    expect(result).toEqual(
      expect.objectContaining({ entityType: 'Leaderboard', leaderboardId: 'lb1', eventName: 'MODIFY' }),
    );
  });

  it('returns undefined for unrecognized entity', () => {
    const record = makeDDBRecord('profiles', 'profile_p1', 'MODIFY', {});
    expect(parseRecord(record)).toBeUndefined();
  });

  it('returns undefined when NewImage is missing', () => {
    const record: DynamoDBRecord = { eventName: 'REMOVE', dynamodb: {} };
    expect(parseRecord(record)).toBeUndefined();
  });

  it('parses Submission from PK starting with profile_ and SK containing #submission_', () => {
    const record = makeDDBRecord('profile_p1', 'leaderboard_lb1#submission_sub1', 'MODIFY', {
      videoStreamUrl: { S: 'https://kvs.example.com/stream.m3u8' },
    });
    const result = parseRecord(record);
    expect(result).toEqual(
      expect.objectContaining({ entityType: 'Submission', leaderboardId: 'lb1', eventName: 'MODIFY' }),
    );
  });
});

describe('buildEventsForSubmission', () => {
  it('emits STREAM_READY when videoStreamUrl is set', () => {
    const parsed = {
      entityType: 'Submission' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'profile_p1' },
        sk: { S: 'leaderboard_lb1#submission_sub1' },
        videoStreamUrl: { S: 'https://kvs.example.com/stream.m3u8' },
        modelName: { S: 'SpeedDemon' },
        participantName: { S: 'Alice' },
      },
      oldImage: { pk: { S: 'profile_p1' }, sk: { S: 'leaderboard_lb1#submission_sub1' } },
    };
    const events = buildEventsForSubmission(parsed);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventType: 'STREAM_READY',
        streamUrl: 'https://kvs.example.com/stream.m3u8',
        participantName: 'Alice',
        modelName: 'SpeedDemon',
      }),
    );
  });

  it('does not emit STREAM_READY when videoStreamUrl unchanged', () => {
    const parsed = {
      entityType: 'Submission' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'profile_p1' },
        sk: { S: 'leaderboard_lb1#submission_sub1' },
        videoStreamUrl: { S: 'https://kvs.example.com/stream.m3u8' },
        modelName: { S: 'SpeedDemon' },
      },
      oldImage: {
        pk: { S: 'profile_p1' },
        sk: { S: 'leaderboard_lb1#submission_sub1' },
        videoStreamUrl: { S: 'https://kvs.example.com/stream.m3u8' },
      },
    };
    const events = buildEventsForSubmission(parsed);
    expect(events).toHaveLength(0);
  });

  it('does not emit STREAM_READY when videoStreamUrl is empty', () => {
    const parsed = {
      entityType: 'Submission' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'profile_p1' },
        sk: { S: 'leaderboard_lb1#submission_sub1' },
        modelName: { S: 'SpeedDemon' },
      },
    };
    const events = buildEventsForSubmission(parsed);
    expect(events).toHaveLength(0);
  });
});

describe('buildEventsForLiveQueueItem', () => {
  beforeEach(() => {
    vi.mocked(liveQueueItemDao.getQueue).mockResolvedValue([
      { submissionId: 'sub1', status: 'PENDING', queuePosition: 'a' },
      { submissionId: 'sub2', status: 'PENDING', queuePosition: 'b' },
    ] as never);
  });

  const baseParsed = {
    entityType: 'LiveQueueItem' as const,
    leaderboardId: 'lb1' as ResourceId,
    eventName: 'MODIFY' as const,
    newImage: {
      pk: { S: 'leaderboard_lb1#livequeueitem' },
      sk: { S: 'submission_sub1' },
      status: { S: 'IN_PROGRESS' },
      participantName: { S: 'Alice' },
      modelName: { S: 'SpeedDemon' },
      submissionId: { S: 'sub1' },
      profileId: { S: 'profile1' },
      queuePosition: { S: 'a' },
      resetCount: { N: '0' },
    },
    oldImage: {
      pk: { S: 'leaderboard_lb1#livequeueitem' },
      sk: { S: 'submission_sub1' },
      status: { S: 'PENDING' },
      queuePosition: { S: 'a' },
    },
  };

  it('emits EVALUATION_STARTED and PARTICIPANT_NOTIFICATION on PENDING → IN_PROGRESS', async () => {
    const events = await buildEventsForLiveQueueItem(baseParsed);
    const types = events.map((e) => e.eventType);
    expect(types).toContain('EVALUATION_STARTED');
    expect(types).toContain('PARTICIPANT_NOTIFICATION');
    const evalStarted = events.find((e) => e.eventType === 'EVALUATION_STARTED');
    expect(evalStarted).toEqual(
      expect.objectContaining({
        participantName: 'Alice',
        modelName: 'SpeedDemon',
        submissionId: 'sub1',
        queuePosition: 1,
        totalModels: 2,
        completedModels: 0,
      }),
    );
  });

  it('emits EVALUATION_COMPLETE and PARTICIPANT_NOTIFICATION on → COMPLETED', async () => {
    const parsed = {
      ...baseParsed,
      newImage: { ...baseParsed.newImage, status: { S: 'COMPLETED' } },
      oldImage: { ...baseParsed.oldImage, status: { S: 'IN_PROGRESS' } },
    };
    const events = await buildEventsForLiveQueueItem(parsed);
    const types = events.map((e) => e.eventType);
    expect(types).toContain('EVALUATION_COMPLETE');
    expect(types).toContain('PARTICIPANT_NOTIFICATION');
    const notification = events.find((e) => e.eventType === 'PARTICIPANT_NOTIFICATION');
    expect(notification).toEqual(expect.objectContaining({ notificationType: 'EVALUATION_COMPLETE' }));
  });

  it('emits QUEUE_CHANGED with SUBMISSION_ADDED on INSERT', async () => {
    const parsed = { ...baseParsed, eventName: 'INSERT' as const, oldImage: undefined };
    const events = await buildEventsForLiveQueueItem(parsed);
    expect(events).toContainEqual(expect.objectContaining({ eventType: 'QUEUE_CHANGED', action: 'SUBMISSION_ADDED' }));
  });

  it('emits QUEUE_CHANGED with REORDER on position change', async () => {
    const parsed = {
      ...baseParsed,
      newImage: { ...baseParsed.newImage, status: { S: 'PENDING' }, queuePosition: { S: 'b' } },
      oldImage: { ...baseParsed.oldImage, status: { S: 'PENDING' }, queuePosition: { S: 'a' } },
    };
    const events = await buildEventsForLiveQueueItem(parsed);
    expect(events).toContainEqual(expect.objectContaining({ eventType: 'QUEUE_CHANGED', action: 'REORDER' }));
  });

  it('emits QUEUE_CHANGED with RESET on status change to PENDING (not IN_PROGRESS/COMPLETED)', async () => {
    const parsed = {
      ...baseParsed,
      newImage: { ...baseParsed.newImage, status: { S: 'PENDING' } },
      oldImage: { ...baseParsed.oldImage, status: { S: 'FAILED' } },
    };
    const events = await buildEventsForLiveQueueItem(parsed);
    expect(events).toContainEqual(expect.objectContaining({ eventType: 'QUEUE_CHANGED', action: 'RESET' }));
  });

  it('emits QUEUE_CHANGED with newStatus on IN_PROGRESS transition for queue panel updates', async () => {
    const events = await buildEventsForLiveQueueItem(baseParsed);
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: 'QUEUE_CHANGED', action: 'SKIP', newStatus: 'IN_PROGRESS' }),
    );
  });

  it('does not emit events when status unchanged', async () => {
    const parsed = {
      ...baseParsed,
      newImage: { ...baseParsed.newImage, status: { S: 'PENDING' } },
      oldImage: { ...baseParsed.oldImage, status: { S: 'PENDING' } },
    };
    const events = await buildEventsForLiveQueueItem(parsed);
    expect(events).toHaveLength(0);
  });

  it('treats MODIFY with undefined oldImage as fresh transition', async () => {
    const parsed = {
      ...baseParsed,
      newImage: { ...baseParsed.newImage, status: { S: 'IN_PROGRESS' } },
      oldImage: undefined,
    };
    const events = await buildEventsForLiveQueueItem(parsed);
    expect(events).toContainEqual(expect.objectContaining({ eventType: 'EVALUATION_STARTED' }));
  });
});

describe('buildEventsForRanking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParsed = {
    entityType: 'Ranking' as const,
    leaderboardId: 'lb1' as ResourceId,
    eventName: 'MODIFY' as const,
    newImage: {
      pk: { S: 'leaderboard_lb1' },
      sk: { S: 'profile_p1#ranking' },
      profileId: { S: 'p1' },
      rankingScore: { N: '12000' },
      userProfile: { M: { alias: { S: 'Alice' } } },
    },
  };

  it('emits LEADERBOARD_UPDATED with full rankings', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { profileId: 'p1', rankingScore: 12000, userProfile: { alias: 'Alice', avatar: {} } },
        { profileId: 'p2', rankingScore: 14000, userProfile: { alias: 'Bob', avatar: {} } },
      ],
      cursor: null,
    } as never);

    const events = await buildEventsForRanking(baseParsed);
    const leaderboardUpdated = events.find((e) => e.eventType === 'LEADERBOARD_UPDATED');
    expect(leaderboardUpdated).toBeDefined();
    expect((leaderboardUpdated as Record<string, unknown>).rankings).toHaveLength(2);
  });

  it('emits FASTEST_TIME notification for rank 1', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [{ profileId: 'p1', rankingScore: 12000, userProfile: { alias: 'Alice', avatar: {} } }],
      cursor: null,
    } as never);

    const events = await buildEventsForRanking(baseParsed);
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: 'PARTICIPANT_NOTIFICATION', notificationType: 'FASTEST_TIME' }),
    );
  });

  it('emits TOP_3 notification for rank 2-3', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { profileId: 'p0', rankingScore: 10000, userProfile: { alias: 'Zara', avatar: {} } },
        { profileId: 'p1', rankingScore: 12000, userProfile: { alias: 'Alice', avatar: {} } },
      ],
      cursor: null,
    } as never);

    const events = await buildEventsForRanking(baseParsed);
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: 'PARTICIPANT_NOTIFICATION', notificationType: 'TOP_3', ranking: 2 }),
    );
  });

  it('does not emit participant notification for rank > 3', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { profileId: 'a', rankingScore: 1000, userProfile: { alias: 'A', avatar: {} } },
        { profileId: 'b', rankingScore: 2000, userProfile: { alias: 'B', avatar: {} } },
        { profileId: 'c', rankingScore: 3000, userProfile: { alias: 'C', avatar: {} } },
        { profileId: 'p1', rankingScore: 12000, userProfile: { alias: 'Alice', avatar: {} } },
      ],
      cursor: null,
    } as never);

    const events = await buildEventsForRanking(baseParsed);
    const notifications = events.filter((e) => e.eventType === 'PARTICIPANT_NOTIFICATION');
    expect(notifications).toHaveLength(0);
  });
});

describe('buildEventsForLeaderboard', () => {
  it('emits RACE_STATUS_CHANGED when liveEventStatus changes', async () => {
    const parsed = {
      entityType: 'Leaderboard' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
      },
      oldImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.SCHEDULED },
      },
    };
    const events = await buildEventsForLeaderboard(parsed);
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: 'RACE_STATUS_CHANGED', status: LiveEventStatus.IN_PROGRESS }),
    );
  });

  it('emits WINNER_DECLARED when status → COMPLETED with winnerId', async () => {
    vi.mocked(rankingDao.listByRank).mockResolvedValue({
      data: [{ profileId: 'p1', rankingScore: 12450, userProfile: { alias: 'Alice', avatar: {} } }],
      cursor: null,
    } as never);
    const parsed = {
      entityType: 'Leaderboard' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.COMPLETED },
        winnerId: { S: 'sub1' },
      },
      oldImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
      },
    };
    const events = await buildEventsForLeaderboard(parsed);
    const types = events.map((e) => e.eventType);
    expect(types).toContain('RACE_STATUS_CHANGED');
    expect(types).toContain('WINNER_DECLARED');
    const winnerEvent = events.find((e) => e.eventType === 'WINNER_DECLARED');
    expect(winnerEvent).toEqual(
      expect.objectContaining({
        winnerId: 'sub1',
        winner: expect.objectContaining({ participantName: 'Alice', bestLapTime: 12450 }),
      }),
    );
  });

  it('does not emit events when status unchanged', async () => {
    const parsed = {
      entityType: 'Leaderboard' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
      },
      oldImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
      },
    };
    const events = await buildEventsForLeaderboard(parsed);
    expect(events).toHaveLength(0);
  });

  it('does not emit WINNER_DECLARED when COMPLETED without winnerId', async () => {
    const parsed = {
      entityType: 'Leaderboard' as const,
      leaderboardId: 'lb1' as ResourceId,
      eventName: 'MODIFY' as const,
      newImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.COMPLETED },
      },
      oldImage: {
        pk: { S: 'leaderboards' },
        sk: { S: 'leaderboard_lb1' },
        liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
      },
    };
    const events = await buildEventsForLeaderboard(parsed);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('RACE_STATUS_CHANGED');
  });
});

describe('publishToIoT', () => {
  beforeEach(() => mockIoTClient.reset());

  it('publishes to correct topic with QoS 1 and includes publishedAt', async () => {
    mockIoTClient.on(PublishCommand).resolves({});
    await publishToIoT('lb1' as ResourceId, { eventType: 'TEST', leaderboardId: 'lb1' });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.topic).toBe('deepracer/test/leaderboard/lb1');
    expect(calls[0].args[0].input.qos).toBe(1);
    const payload = JSON.parse(Buffer.from(calls[0].args[0].input.payload as Buffer).toString());
    expect(payload).toMatchObject({ eventType: 'TEST', leaderboardId: 'lb1' });
    expect(typeof payload.publishedAt).toBe('string');
  });

  it('throws when publish fails', async () => {
    mockIoTClient.on(PublishCommand).rejects(new Error('IoT publish error'));
    await expect(publishToIoT('lb1' as ResourceId, { eventType: 'TEST' })).rejects.toThrow('IoT publish error');
  });

  const MAX = 128 * 1024;

  it('publishes payload exactly at the 128 KB limit', async () => {
    mockIoTClient.on(PublishCommand).resolves({});
    // Craft event so the final encoded payload is exactly MAX bytes
    const base = { data: '', publishedAt: new Date().toISOString() };
    const overhead = Buffer.byteLength(JSON.stringify(base));
    const event = { data: 'x'.repeat(MAX - overhead) };
    await expect(publishToIoT('lb1' as ResourceId, event)).resolves.toBeUndefined();
  });

  it('throws when payload exceeds 128 KB by one byte', async () => {
    mockIoTClient.on(PublishCommand).resolves({});
    const base = { data: '', publishedAt: new Date().toISOString() };
    const overhead = Buffer.byteLength(JSON.stringify(base));
    const event = { data: 'x'.repeat(MAX - overhead + 1) };
    await expect(publishToIoT('lb1' as ResourceId, event)).rejects.toThrow(/exceeds 128 KB/);
  });

  it('publishes payload one byte below 128 KB', async () => {
    mockIoTClient.on(PublishCommand).resolves({});
    const base = { data: '', publishedAt: new Date().toISOString() };
    const overhead = Buffer.byteLength(JSON.stringify(base));
    const event = { data: 'x'.repeat(MAX - overhead - 1) };
    await expect(publishToIoT('lb1' as ResourceId, event)).resolves.toBeUndefined();
  });
});

describe('handler integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIoTClient.reset();
    mockIoTClient.on(PublishCommand).resolves({});
    vi.mocked(liveQueueItemDao.getQueue).mockResolvedValue([
      { submissionId: 'sub1', status: 'IN_PROGRESS', queuePosition: 'a' },
    ] as never);
  });

  const liveLeaderboard = {
    isLive: true,
    liveEventStatus: LiveEventStatus.IN_PROGRESS,
  };

  it('skips records with unrecognized entity type', async () => {
    mockLeaderboardDao.get.mockResolvedValue(liveLeaderboard as never);
    const event = {
      Records: [makeDDBRecord('profiles', 'profile_p1', 'MODIFY', { alias: { S: 'test' } })],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockIoTClient).not.toHaveReceivedCommand(PublishCommand);
  });

  it('skips when leaderboard not found', async () => {
    mockLeaderboardDao.get.mockResolvedValue(undefined as never);
    const event = {
      Records: [
        makeDDBRecord('leaderboard_lb1#livequeueitem', 'submission_sub1', 'MODIFY', {
          status: { S: 'IN_PROGRESS' },
          participantName: { S: 'Alice' },
          modelName: { S: 'Model' },
          submissionId: { S: 'sub1' },
          profileId: { S: 'p1' },
          queuePosition: { S: 'a' },
          resetCount: { N: '0' },
        }),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockIoTClient).not.toHaveReceivedCommand(PublishCommand);
  });

  it('skips LiveQueueItem when leaderboard is not live', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: false } as never);
    const event = {
      Records: [
        makeDDBRecord('leaderboard_lb1#livequeueitem', 'submission_sub1', 'MODIFY', {
          status: { S: 'IN_PROGRESS' },
          participantName: { S: 'Alice' },
          modelName: { S: 'Model' },
          submissionId: { S: 'sub1' },
          profileId: { S: 'p1' },
          queuePosition: { S: 'a' },
          resetCount: { N: '0' },
        }),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockIoTClient).not.toHaveReceivedCommand(PublishCommand);
  });

  it('skips LiveQueueItem when race is COMPLETED', async () => {
    mockLeaderboardDao.get.mockResolvedValue({
      isLive: true,
      liveEventStatus: LiveEventStatus.COMPLETED,
    } as never);
    const event = {
      Records: [
        makeDDBRecord('leaderboard_lb1#livequeueitem', 'submission_sub1', 'MODIFY', {
          status: { S: 'IN_PROGRESS' },
          participantName: { S: 'Alice' },
          modelName: { S: 'Model' },
          submissionId: { S: 'sub1' },
          profileId: { S: 'p1' },
          queuePosition: { S: 'a' },
          resetCount: { N: '0' },
        }),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockIoTClient).not.toHaveReceivedCommand(PublishCommand);
  });

  it('publishes events for valid LiveQueueItem status change', async () => {
    mockLeaderboardDao.get.mockResolvedValue(liveLeaderboard as never);
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub1',
          'MODIFY',
          {
            status: { S: 'IN_PROGRESS' },
            participantName: { S: 'Alice' },
            modelName: { S: 'SpeedDemon' },
            submissionId: { S: 'sub1' },
            profileId: { S: 'p1' },
            queuePosition: { S: 'a' },
            resetCount: { N: '0' },
          },
          { status: { S: 'PENDING' }, queuePosition: { S: 'a' } },
        ),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    // EVALUATION_STARTED + PARTICIPANT_NOTIFICATION + QUEUE_CHANGED = 3 separate publishes
    expect(mockIoTClient.commandCalls(PublishCommand)).toHaveLength(3);
  });

  it('continues processing after error on one record', async () => {
    mockLeaderboardDao.get
      .mockRejectedValueOnce(new Error('DDB error'))
      .mockResolvedValueOnce(liveLeaderboard as never);
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub1',
          'INSERT',
          {
            status: { S: 'PENDING' },
            participantName: { S: 'Alice' },
            modelName: { S: 'Model' },
            submissionId: { S: 'sub1' },
            profileId: { S: 'p1' },
            queuePosition: { S: 'a' },
            resetCount: { N: '0' },
          },
          undefined,
          'seq-failed-1',
        ),
        makeDDBRecord(
          'leaderboard_lb2#livequeueitem',
          'submission_sub2',
          'INSERT',
          {
            status: { S: 'PENDING' },
            participantName: { S: 'Bob' },
            modelName: { S: 'Model2' },
            submissionId: { S: 'sub2' },
            profileId: { S: 'p2' },
            queuePosition: { S: 'b' },
            resetCount: { N: '0' },
          },
          undefined,
          'seq-success-2',
        ),
      ],
    };
    const result = await handler(event as never);
    // First record errored (DDB load), reported for retry. Second succeeded.
    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'seq-failed-1' }] });
    expect(mockIoTClient).toHaveReceivedCommand(PublishCommand);
  });

  it('skips Leaderboard entity when not live', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: false } as never);
    const event = {
      Records: [
        makeDDBRecord('leaderboards', 'leaderboard_lb1', 'MODIFY', {
          liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
        }),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockIoTClient).not.toHaveReceivedCommand(PublishCommand);
  });

  it('uses stream newImage.isLive for Leaderboard even when DAO returns stale false', async () => {
    // Simulates eventual consistency: DAO returns isLive=false, but the stream record
    // is the one that just set isLive=true, so the handler should still broadcast.
    mockLeaderboardDao.get.mockResolvedValue({ isLive: false } as never);
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboards',
          'leaderboard_lb1',
          'MODIFY',
          {
            liveEventStatus: { S: LiveEventStatus.IN_PROGRESS },
            isLive: { BOOL: true },
          },
          { liveEventStatus: { S: LiveEventStatus.SCHEDULED }, isLive: { BOOL: true } },
        ),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockIoTClient).toHaveReceivedCommand(PublishCommand);
  });

  it('refreshes leaderboard cache with newImage when processing Leaderboard, so subsequent records see latest state', async () => {
    // Batch contains: (1) Leaderboard flipping isLive=true, (2) LiveQueueItem for same leaderboard.
    // DAO returns stale isLive=false. Without cache refresh, the LiveQueueItem would be skipped.
    mockLeaderboardDao.get.mockResolvedValue({
      isLive: false,
      liveEventStatus: LiveEventStatus.SCHEDULED,
    } as never);
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboards',
          'leaderboard_lb1',
          'MODIFY',
          { liveEventStatus: { S: LiveEventStatus.IN_PROGRESS }, isLive: { BOOL: true } },
          { liveEventStatus: { S: LiveEventStatus.SCHEDULED }, isLive: { BOOL: true } },
          'seq-lb-1',
        ),
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub1',
          'MODIFY',
          {
            status: { S: 'IN_PROGRESS' },
            participantName: { S: 'Alice' },
            modelName: { S: 'SpeedDemon' },
            submissionId: { S: 'sub1' },
            profileId: { S: 'p1' },
            queuePosition: { S: 'a' },
            resetCount: { N: '0' },
          },
          { status: { S: 'PENDING' }, queuePosition: { S: 'a' } },
          'seq-queue-2',
        ),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    // DAO called only once (cached), queue item's evaluation-started fires because cache was refreshed
    expect(mockLeaderboardDao.get).toHaveBeenCalledTimes(1);
    const publishedTypes = mockIoTClient.commandCalls(PublishCommand).map((call) => {
      const payload = JSON.parse(Buffer.from(call.args[0].input.payload as Buffer).toString());
      return (payload as { eventType: string }).eventType;
    });
    expect(publishedTypes).toContain('EVALUATION_STARTED');
  });

  it('reports record in batchItemFailures when a publish fails', async () => {
    mockLeaderboardDao.get.mockResolvedValue(liveLeaderboard as never);
    mockIoTClient.on(PublishCommand).rejectsOnce(new Error('IoT publish error'));
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub1',
          'MODIFY',
          {
            status: { S: 'IN_PROGRESS' },
            participantName: { S: 'Alice' },
            modelName: { S: 'SpeedDemon' },
            submissionId: { S: 'sub1' },
            profileId: { S: 'p1' },
            queuePosition: { S: 'a' },
            resetCount: { N: '0' },
          },
          { status: { S: 'PENDING' }, queuePosition: { S: 'a' } },
          'seq-partial-fail',
        ),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'seq-partial-fail' }] });
  });

  it('deduplicates leaderboardDao.get calls across records for same leaderboard', async () => {
    mockLeaderboardDao.get.mockResolvedValue(liveLeaderboard as never);
    const baseAttrs = {
      status: { S: 'PENDING' },
      participantName: { S: 'Alice' },
      modelName: { S: 'SpeedDemon' },
      profileId: { S: 'p1' },
      queuePosition: { S: 'a' },
      resetCount: { N: '0' },
    };
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub1',
          'INSERT',
          { ...baseAttrs, submissionId: { S: 'sub1' } },
          undefined,
          'seq-1',
        ),
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub2',
          'INSERT',
          { ...baseAttrs, submissionId: { S: 'sub2' } },
          undefined,
          'seq-2',
        ),
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub3',
          'INSERT',
          { ...baseAttrs, submissionId: { S: 'sub3' } },
          undefined,
          'seq-3',
        ),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    // 3 records for same leaderboard should trigger only 1 DAO load (cached)
    expect(mockLeaderboardDao.get).toHaveBeenCalledTimes(1);
  });

  it('deduplicates leaderboardDao.get calls for non-existent leaderboard', async () => {
    mockLeaderboardDao.get.mockResolvedValue(null as never);
    const baseAttrs = {
      status: { S: 'PENDING' },
      participantName: { S: 'Alice' },
      modelName: { S: 'Model' },
      profileId: { S: 'p1' },
      queuePosition: { S: 'a' },
      resetCount: { N: '0' },
    };
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub1',
          'INSERT',
          { ...baseAttrs, submissionId: { S: 'sub1' } },
          undefined,
          'seq-1',
        ),
        makeDDBRecord(
          'leaderboard_lb1#livequeueitem',
          'submission_sub2',
          'INSERT',
          { ...baseAttrs, submissionId: { S: 'sub2' } },
          undefined,
          'seq-2',
        ),
      ],
    };
    const result = await handler(event as never);
    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockLeaderboardDao.get).toHaveBeenCalledTimes(1);
  });
});
