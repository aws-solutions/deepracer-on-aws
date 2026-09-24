// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  eventDao,
  lapDao,
  leaderboardDao,
  liveQueueItemDao,
  rankingDao,
  type ResourceId,
} from '@deepracer-indy/database';
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
  publishLeaderboardToS3,
  handler,
} from '../liveBroadcastHandler.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    eventDao: { get: vi.fn().mockResolvedValue(undefined) },
    leaderboardDao: { get: vi.fn(), listByEventId: vi.fn() },
    liveQueueItemDao: { getQueue: vi.fn() },
    rankingDao: { listByRank: vi.fn() },
    lapDao: { listByRun: vi.fn().mockResolvedValue({ data: [], cursor: null }) },
  };
});

const mockIoTClient = mockClient(IoTDataPlaneClient);
const mockS3Client = mockClient(S3Client);
const mockEventBridgeClient = mockClient(EventBridgeClient);

const mockRankingDao = vi.mocked(rankingDao);
const mockLeaderboardDao = vi.mocked(leaderboardDao);
const mockLapDao = vi.mocked(lapDao);
const mockEventDao = vi.mocked(eventDao);

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

describe('handler integration - physical routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIoTClient.reset();
    mockIoTClient.on(PublishCommand).resolves({});
  });

  const decodePayload = (payload: unknown): Record<string, unknown> => {
    if (typeof payload === 'string') return JSON.parse(payload);
    if (payload instanceof Uint8Array) return JSON.parse(Buffer.from(payload).toString());
    return {};
  };

  it('publishes RACE_STATUS_CHANGED to the race topic for a physical Event record', async () => {
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: 'track-1' }],
      cursor: null,
    } as never);
    const event = {
      Records: [
        makeDDBRecord(
          'events',
          'event#evt-1',
          'MODIFY',
          { eventStatus: { S: 'IN_PROGRESS' } },
          { eventStatus: { S: 'OPEN' } },
        ),
      ],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.topic).toBe('deepracer/test/race/evt-1/track-1');
    expect(decodePayload(calls[0].args[0].input.payload)).toMatchObject({
      eventType: 'RACE_STATUS_CHANGED',
      eventId: 'evt-1',
      trackId: 'track-1',
      status: 'IN_PROGRESS',
    });
  });

  it('fans out RACE_STATUS_CHANGED to every track on a multi-track event', async () => {
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: 'track-1' }, { leaderboardId: 'track-2' }],
      cursor: null,
    } as never);
    const event = {
      Records: [
        makeDDBRecord(
          'events',
          'event#evt-1',
          'MODIFY',
          { eventStatus: { S: 'IN_PROGRESS' } },
          { eventStatus: { S: 'OPEN' } },
        ),
      ],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.args[0].input.topic)).toEqual([
      'deepracer/test/race/evt-1/track-1',
      'deepracer/test/race/evt-1/track-2',
    ]);
  });

  it('publishes RUN_STARTED to the race topic for a physical Run when the leaderboard has an eventId', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-9' } as never);
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb-1',
          'run_run-1',
          'MODIFY',
          {
            runId: { S: 'run-1' },
            runStatus: { S: 'IN_PROGRESS' },
            profileId: { S: 'racer-1' },
          },
          { runStatus: { S: 'READY' } },
        ),
      ],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.topic).toBe('deepracer/test/race/evt-9/lb-1');
    expect(decodePayload(calls[0].args[0].input.payload)).toMatchObject({
      eventType: 'RUN_STARTED',
      eventId: 'evt-9',
      trackId: 'lb-1',
      racerId: 'racer-1',
    });
  });

  it('publishes LEADERBOARD_UPDATED to the race topic for a physical Ranking, and hydrates S3', async () => {
    mockLeaderboardDao.get.mockResolvedValue({
      isLive: true,
      eventId: 'evt-9',
      name: 'Track 1',
      leaderBoardFooter: 'Presented by Acme Racing',
    } as never);
    mockRankingDao.listByRank.mockResolvedValue({
      data: [{ rankingScore: 10000, userProfile: { alias: 'Alice', countryCode: 'US' } }],
      cursor: null,
    } as never);
    const event = {
      Records: [makeDDBRecord('leaderboard_lb-1', 'profile_p1#ranking', 'MODIFY', { rankingScore: { N: '10000' } })],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    // A physical ranking change publishes the per-track LEADERBOARD_UPDATED and also triggers the
    // combined-leaderboard push, so expect both the per-track and the combined topic.
    const perTrackCall = calls.find((c) => c.args[0].input.topic === 'deepracer/test/race/evt-9/lb-1');
    expect(perTrackCall).toBeDefined();
    expect(decodePayload(perTrackCall?.args[0].input.payload)).toMatchObject({
      eventType: 'LEADERBOARD_UPDATED',
      eventId: 'evt-9',
      rankings: [expect.objectContaining({ country: 'US' })],
    });

    const combinedCall = calls.find((c) => c.args[0].input.topic === 'deepracer/test/race/evt-9/combined');
    expect(combinedCall).toBeDefined();
    expect(decodePayload(combinedCall?.args[0].input.payload)).toMatchObject({
      eventType: 'LEADERBOARD_UPDATED',
      eventId: 'evt-9',
      trackId: 'combined',
      rankings: [expect.objectContaining({ country: 'US' })],
    });

    // A LEADERBOARD_UPDATED physical event must also hydrate the per-track S3 leaderboard, the
    // same as the virtual path already does — otherwise a fresh page load of the public
    // leaderboard shows no results until a live IoT event happens to land while a tab is open.
    const s3Calls = mockS3Client.commandCalls(PutObjectCommand);
    const perTrackS3Call = s3Calls.find((c) => c.args[0].input.Key === 'public/leaderboards/lb-1.json');
    expect(perTrackS3Call).toBeDefined();
    const body = JSON.parse(perTrackS3Call?.args[0].input.Body as string);
    expect(body).toMatchObject({ leaderboardId: 'lb-1', name: 'Track 1', footer: 'Presented by Acme Racing' });
    expect(body.rankings).toEqual([
      expect.objectContaining({ rank: 1, participantName: 'Alice', bestLapTimeMilliseconds: 10000 }),
    ]);
  });

  it('does not let an S3 publish failure block the IoT broadcast for a physical Ranking', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-9', name: 'Track 1' } as never);
    mockRankingDao.listByRank.mockResolvedValue({
      data: [{ rankingScore: 10000, userProfile: { alias: 'Alice' } }],
      cursor: null,
    } as never);
    mockS3Client.on(PutObjectCommand).rejects(new Error('S3 unavailable'));
    const event = {
      Records: [makeDDBRecord('leaderboard_lb-1', 'profile_p1#ranking', 'MODIFY', { rankingScore: { N: '10000' } })],
    };

    const result = await handler(event as never);

    // The batch item must not be marked as failed — an S3 hydration failure is a secondary
    // artifact and must never affect the real-time IoT broadcast that already completed.
    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    expect(calls.find((c) => c.args[0].input.topic === 'deepracer/test/race/evt-9/lb-1')).toBeDefined();
  });

  it('falls through to the virtual path when the leaderboard has no eventId', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, liveEventStatus: LiveEventStatus.IN_PROGRESS } as never);
    mockRankingDao.listByRank.mockResolvedValue({
      data: [{ rankingScore: 10000, userProfile: { alias: 'Alice' } }],
      cursor: null,
    } as never);
    const event = {
      Records: [
        makeDDBRecord('leaderboard_lb-1', 'profile_p1#ranking', 'MODIFY', {
          rankingScore: { N: '10000' },
          profileId: { S: 'p1' },
        }),
      ],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockIoTClient.commandCalls(PublishCommand);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.args[0].input.topic).not.toContain('/race/');
    }
  });

  it('records a batch item failure when physical processing throws', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-9' } as never);
    mockRankingDao.listByRank.mockRejectedValue(new Error('ranking query failed'));
    const event = {
      Records: [
        makeDDBRecord(
          'leaderboard_lb-1',
          'profile_p1#ranking',
          'MODIFY',
          { rankingScore: { N: '10000' } },
          undefined,
          'seq-42',
        ),
      ],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'seq-42' }] });
  });

  const makeRemoveRecord = (
    pk: string,
    sk: string,
    oldImage: Record<string, unknown>,
    sequenceNumber: string,
  ): DynamoDBRecord => ({
    eventName: 'REMOVE',
    dynamodb: {
      SequenceNumber: sequenceNumber,
      OldImage: { pk: { S: pk }, sk: { S: sk }, ...oldImage },
    },
  });

  it('recomputes the combined leaderboard when a physical Ranking is removed (REMOVE has no NewImage)', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-9' } as never);
    const event = {
      Records: [makeRemoveRecord('leaderboard_lb-1', 'profile_p1#ranking', {}, 'seq-remove-1')],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockLeaderboardDao.get).toHaveBeenCalledWith({ leaderboardId: 'lb-1' });
    expect(mockEventDao.get).toHaveBeenCalledWith({ eventId: 'evt-9' });
    // No per-track broadcast for a deletion — only the combined-leaderboard recompute runs.
    expect(mockIoTClient).not.toHaveReceivedCommand(PublishCommand);
  });

  it('publishes the combined leaderboard to S3 keyed by eventId with the event name', async () => {
    // Self-contained: this describe resets mockIoTClient but not mockS3Client, so reset here.
    mockS3Client.reset();
    mockS3Client.on(PutObjectCommand).resolves({});
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-9' } as never);
    mockEventDao.get.mockResolvedValue({
      eventId: 'evt-9',
      name: 'Madrid Summit',
      combinedLeaderBoardFooter: 'Sponsored by Acme Corp',
    } as never);
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);

    const event = {
      Records: [makeRemoveRecord('leaderboard_lb-1', 'profile_p1#ranking', {}, 'seq-remove-combined')],
    };

    await handler(event as never);

    // The combined leaderboard is stored under leaderboardId = eventId, so it is published to
    // public/leaderboards/{eventId}.json with the event name and combined footer as the display title/footer.
    const combinedPut = mockS3Client
      .commandCalls(PutObjectCommand)
      .find((c) => c.args[0].input.Key === 'public/leaderboards/evt-9.json');
    expect(combinedPut).toBeDefined();
    const body = JSON.parse((combinedPut?.args[0].input.Body as string) ?? '{}');
    expect(body.name).toBe('Madrid Summit');
    expect(body.footer).toBe('Sponsored by Acme Corp');
  });

  it('falls through without recomputing when a removed Ranking belongs to a virtual (non-event) leaderboard', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true } as never);
    const event = {
      Records: [makeRemoveRecord('leaderboard_lb-1', 'profile_p1#ranking', {}, 'seq-remove-2')],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockEventDao.get).not.toHaveBeenCalled();
  });

  it('ignores REMOVE events for entities other than Ranking (e.g. LiveQueueItem)', async () => {
    const event = {
      Records: [makeRemoveRecord('leaderboard_lb-1#livequeueitem', 'submission_sub1', {}, 'seq-remove-3')],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockEventDao.get).not.toHaveBeenCalled();
  });

  it('records a batch item failure when resolving the leaderboard for a Ranking REMOVE throws', async () => {
    mockLeaderboardDao.get.mockRejectedValue(new Error('DDB unavailable'));
    const event = {
      Records: [makeRemoveRecord('leaderboard_lb-1', 'profile_p1#ranking', {}, 'seq-remove-4')],
    };

    const result = await handler(event as never);

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'seq-remove-4' }] });
  });
});

describe('module startup env var guard', () => {
  it('throws at module load when required env vars are missing', async () => {
    const savedIot = process.env.IOT_ENDPOINT;
    const savedPrefix = process.env.TOPIC_PREFIX;
    const savedRace = process.env.RACE_TOPIC_PREFIX;
    delete process.env.IOT_ENDPOINT;
    delete process.env.TOPIC_PREFIX;
    delete process.env.RACE_TOPIC_PREFIX;

    await expect(import('../liveBroadcastHandler.js?missing-env=' + Date.now())).rejects.toThrow(
      /Missing required environment variables/,
    );

    process.env.IOT_ENDPOINT = savedIot;
    process.env.TOPIC_PREFIX = savedPrefix;
    process.env.RACE_TOPIC_PREFIX = savedRace;
  });
});

describe('publishToRaceTopic 128 KB boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIoTClient.reset();
    mockIoTClient.on(PublishCommand).resolves({});
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-1' } as never);
  });

  it('throws when a physical event payload exceeds 128 KB', async () => {
    const MAX = 128 * 1024;
    // Build a ranking payload large enough to exceed the limit
    const bigName = 'A'.repeat(MAX);
    mockRankingDao.listByRank.mockResolvedValue({
      data: [{ rankingScore: 10000, userProfile: { alias: bigName } }],
      cursor: null,
    } as never);
    const event = {
      Records: [makeDDBRecord('leaderboard_lb-1', 'profile_p1#ranking', 'MODIFY', { rankingScore: { N: '10000' } })],
    };

    const result = await handler(event as never);
    expect(result.batchItemFailures).toHaveLength(1);
  });
});

describe('resolveFromCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIoTClient.reset();
    mockIoTClient.on(PublishCommand).resolves({});
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);
  });

  it('serves the leaderboard from cache on the second lookup without calling the DAO again', async () => {
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-1' } as never);
    const event = {
      Records: [
        makeDDBRecord('leaderboard_lb-cache', 'profile_p1#ranking', 'MODIFY', { rankingScore: { N: '10000' } }),
        makeDDBRecord('leaderboard_lb-cache', 'profile_p2#ranking', 'MODIFY', { rankingScore: { N: '9000' } }),
      ],
    };

    await handler(event as never);

    // Two records for the same leaderboard — DAO should only be called once
    expect(mockLeaderboardDao.get).toHaveBeenCalledTimes(1);
  });
});

describe('publishLeaderboardToS3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Client.reset();
    mockS3Client.on(PutObjectCommand).resolves({});
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);
  });

  it('writes full rankings JSON to the correct S3 key', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { rankingScore: 10000, userProfile: { alias: 'Alice', countryCode: 'US' }, modelName: 'SpeedBot' },
        { rankingScore: 11000, userProfile: { alias: 'Bob', countryCode: 'CA' }, modelName: 'FastBot' },
      ],
      cursor: null,
    } as never);

    await publishLeaderboardToS3('lb-1' as ResourceId);

    const calls = mockS3Client.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe('public/leaderboards/lb-1.json');
    expect(calls[0].args[0].input.Bucket).toBe('test-public-leaderboard-bucket');
    expect(calls[0].args[0].input.ContentType).toBe('application/json');

    const body = JSON.parse(calls[0].args[0].input.Body as string);
    expect(body.rankings).toHaveLength(2);
    expect(body.rankings[0]).toMatchObject({ rank: 1, participantName: 'Alice', country: 'US', modelName: 'SpeedBot' });
  });

  it('includes the leaderboard name in the S3 body when provided', async () => {
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);

    await publishLeaderboardToS3('lb-1' as ResourceId, 'Madrid Summit — Track A');

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.name).toBe('Madrid Summit — Track A');
  });

  it('omits the name field when no leaderboard name is provided', async () => {
    await publishLeaderboardToS3('lb-1' as ResourceId);

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.name).toBeUndefined();
  });

  it('HTML-encodes unsafe chars in the leaderboard name, matching the other display fields', async () => {
    await publishLeaderboardToS3('lb-1' as ResourceId, '<b>Madrid</b> & Friends');

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.name).toBe('&lt;b&gt;Madrid&lt;/b&gt; &amp; Friends');
  });

  it('includes the leaderboard footer in the S3 body when provided', async () => {
    await publishLeaderboardToS3('lb-1' as ResourceId, 'Madrid Summit — Track A', 'Sponsored by Acme Corp');

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.footer).toBe('Sponsored by Acme Corp');
  });

  it('omits the footer field when no leaderboard footer is provided', async () => {
    await publishLeaderboardToS3('lb-1' as ResourceId, 'Madrid Summit — Track A');

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.footer).toBeUndefined();
  });

  it('HTML-encodes unsafe chars in the leaderboard footer, matching the other display fields', async () => {
    await publishLeaderboardToS3('lb-1' as ResourceId, 'Madrid Summit', '<script>alert(1)</script>');

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.footer).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('HTML-encodes unsafe chars in display fields rather than stripping them', async () => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        {
          rankingScore: 5000,
          userProfile: { alias: '<script>alert(1)</script>', countryCode: 'US' },
          modelName: 'A&B',
        },
      ],
      cursor: null,
    } as never);

    await publishLeaderboardToS3('lb-1' as ResourceId);

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.rankings[0].participantName).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body.rankings[0].modelName).toBe('A&amp;B');
  });

  it('writes an empty rankings array when there are no entries', async () => {
    await publishLeaderboardToS3('lb-empty' as ResourceId);

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.rankings).toHaveLength(0);
  });

  it('queries all rankings without maxResults cap (full list for S3)', async () => {
    await publishLeaderboardToS3('lb-1' as ResourceId);
    expect(mockRankingDao.listByRank).toHaveBeenCalledWith({ leaderboardId: 'lb-1', cursor: null });
  });

  it('follows pagination cursor until exhausted', async () => {
    mockRankingDao.listByRank
      .mockResolvedValueOnce({
        data: [{ rankingScore: 1000, userProfile: { alias: 'Alice' }, modelName: 'A' }],
        cursor: 'page2cursor',
      } as never)
      .mockResolvedValueOnce({
        data: [{ rankingScore: 2000, userProfile: { alias: 'Bob' }, modelName: 'B' }],
        cursor: null,
      } as never);

    await publishLeaderboardToS3('lb-1' as ResourceId);

    expect(mockRankingDao.listByRank).toHaveBeenCalledTimes(2);
    expect(mockRankingDao.listByRank).toHaveBeenNthCalledWith(2, { leaderboardId: 'lb-1', cursor: 'page2cursor' });

    const body = JSON.parse(mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input.Body as string);
    expect(body.rankings).toHaveLength(2);
    expect(body.rankings[0].participantName).toBe('Alice');
    expect(body.rankings[1].participantName).toBe('Bob');
  });

  it('rejects on S3 PutObject failure (caller is responsible for swallowing)', async () => {
    mockS3Client.on(PutObjectCommand).rejects(new Error('S3 throttle'));
    await expect(publishLeaderboardToS3('lb-1' as ResourceId)).rejects.toThrow('S3 throttle');
  });
});

describe('handler integration - EventBridge race-submitted', () => {
  const runFinishedRecord = makeDDBRecord(
    'leaderboard_lb-1',
    'run_run-1',
    'MODIFY',
    { runId: { S: 'run-1' }, runStatus: { S: 'SUBMITTED' }, profileId: { S: 'racer-1' } },
    { runStatus: { S: 'IN_PROGRESS' } },
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockIoTClient.reset();
    mockIoTClient.on(PublishCommand).resolves({});
    mockEventBridgeClient.reset();
    mockEventBridgeClient.on(PutEventsCommand).resolves({ FailedEntryCount: 0, Entries: [] } as never);
    mockLeaderboardDao.get.mockResolvedValue({ isLive: true, eventId: 'evt-1' } as never);
    mockRankingDao.listByRank.mockResolvedValue({ data: [], cursor: null } as never);
    mockLapDao.listByRun.mockResolvedValue({ data: [], cursor: null } as never);
    mockEventDao.get.mockResolvedValue({ eventId: 'evt-1', raceFormat: 'BEST_LAP' } as never);
    mockS3Client.reset();
    mockS3Client.on(PutObjectCommand).resolves({});
  });

  it('emits race-submitted to EventBridge when a run transitions to SUBMITTED', async () => {
    mockEventBridgeClient.on(PutEventsCommand).resolves({ FailedEntryCount: 0, Entries: [] } as never);

    const result = await handler({ Records: [runFinishedRecord] } as never);

    expect(result).toEqual({ batchItemFailures: [] });
    const calls = mockEventBridgeClient.commandCalls(PutEventsCommand);
    expect(calls).toHaveLength(1);
    const entries = calls[0].args[0].input.Entries ?? [];
    const entry = entries[0];
    expect(entry.EventBusName).toBe('test-deepracer-events');
    expect(entry.Source).toBe('deepracer.test');
    expect(entry.DetailType).toBe('race-submitted');
    expect(JSON.parse(entry.Detail ?? '{}')).toMatchObject({ eventId: 'evt-1', trackId: 'lb-1' });
  });

  it('logs an error but does not fail the batch when FailedEntryCount > 0', async () => {
    mockEventBridgeClient.on(PutEventsCommand).resolves({
      FailedEntryCount: 1,
      Entries: [{ ErrorCode: 'ThrottlingException', ErrorMessage: 'Rate exceeded' }],
    } as never);

    const result = await handler({ Records: [runFinishedRecord] } as never);

    // Non-fatal — batch item must still succeed regardless of EventBridge outcome
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it('logs an error but does not fail the batch when PutEvents throws', async () => {
    mockEventBridgeClient.on(PutEventsCommand).rejects(new Error('network timeout'));

    const result = await handler({ Records: [runFinishedRecord] } as never);

    // Non-fatal — EventBridge failure must not affect the broadcast path
    expect(result).toEqual({ batchItemFailures: [] });
  });
});
