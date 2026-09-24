// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, lapDao, leaderboardDao, rankingDao } from '@deepracer-indy/database';
import { RaceFormat, RunStatus } from '@deepracer-indy/typescript-server-client';
import type { DynamoDBRecord } from 'aws-lambda';

import {
  buildEventsForEvent,
  buildEventsForPhysicalRanking,
  buildEventsForRun,
  buildPhysicalTopic,
  parsePhysicalRecord,
} from '../physical/index.js';

vi.mock('@deepracer-indy/database', () => ({
  rankingDao: { listByRank: vi.fn() },
  lapDao: { listByRun: vi.fn() },
  eventDao: { get: vi.fn() },
  leaderboardDao: { listByEventId: vi.fn() },
}));

const mockRankingDao = vi.mocked(rankingDao);
const mockLapDao = vi.mocked(lapDao);
const mockEventDao = vi.mocked(eventDao);
const mockLeaderboardDao = vi.mocked(leaderboardDao);

// --- Fixture helpers ---

const makeDDBRecord = (
  pk: string,
  sk: string,
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE',
  newImage: Record<string, unknown>,
  oldImage?: Record<string, unknown>,
): DynamoDBRecord => ({
  eventName,
  dynamodb: {
    SequenceNumber: '100000000000000000001',
    NewImage: { pk: { S: pk }, sk: { S: sk }, ...newImage },
    ...(oldImage ? { OldImage: { pk: { S: pk }, sk: { S: sk }, ...oldImage } } : {}),
  },
});

const makeRunRecord = (
  leaderboardId: string,
  runId: string,
  status: string,
  oldStatus?: string,
  extras: Record<string, unknown> = {},
): DynamoDBRecord =>
  makeDDBRecord(
    `leaderboard_${leaderboardId}`,
    `run_${runId}`,
    'MODIFY',
    {
      runId: { S: runId },
      runStatus: { S: status },
      profileId: { S: 'racer-1' },
      ...extras,
    },
    oldStatus ? { runStatus: { S: oldStatus } } : undefined,
  );

const makeRankingRecord = (leaderboardId: string, profileId: string): DynamoDBRecord =>
  makeDDBRecord(`leaderboard_${leaderboardId}`, `profile_${profileId}#ranking`, 'MODIFY', {
    rankingScore: { N: '12000' },
    profileId: { S: profileId },
    userProfile: { M: { alias: { S: 'Alice' } } },
  });

const makeEventRecord = (eventId: string, status: string, oldStatus?: string): DynamoDBRecord =>
  makeDDBRecord(
    'events',
    `event#${eventId}`,
    'MODIFY',
    { eventStatus: { S: status } },
    oldStatus ? { eventStatus: { S: oldStatus } } : undefined,
  );

/**
 * Helper that asserts parsePhysicalRecord returns a defined result and narrows the type.
 */
function expectParsed(record: DynamoDBRecord, eventId: string) {
  const parsed = parsePhysicalRecord(record, eventId);
  expect(parsed).toBeDefined();
  if (!parsed) throw new Error('Expected parsed to be defined');
  return parsed;
}

describe('parsePhysicalRecord', () => {
  it('detects a Run entity from SK "run_{runId}"', () => {
    const result = expectParsed(makeRunRecord('lb-1', 'run-1', RunStatus.IN_PROGRESS, RunStatus.READY), 'evt-1');
    expect(result.entityType).toBe('Run');
    expect(result.leaderboardId).toBe('lb-1');
    expect(result.eventId).toBe('evt-1');
  });

  it('detects a Physical Ranking when eventId is present', () => {
    const result = expectParsed(makeRankingRecord('lb-1', 'p-1'), 'evt-1');
    expect(result.entityType).toBe('PhysicalRanking');
    expect(result.eventId).toBe('evt-1');
  });

  it('returns undefined for Ranking when no eventId (virtual)', () => {
    const record = makeRankingRecord('lb-1', 'p-1');
    const result = parsePhysicalRecord(record, undefined);
    expect(result).toBeUndefined();
  });

  it('detects an Event entity from PK=events and parses eventId from the "event#" SK', () => {
    const result = expectParsed(makeEventRecord('evt-1', 'IN_PROGRESS', 'OPEN'), 'evt-1');
    expect(result.entityType).toBe('Event');
    expect(result.eventId).toBe('evt-1');
    expect(result.leaderboardId).toBe('');
  });

  it('returns undefined for Run when no leaderboardEventId', () => {
    const record = makeRunRecord('lb-1', 'run-1', RunStatus.IN_PROGRESS, RunStatus.READY);
    const result = parsePhysicalRecord(record, undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined when NewImage is missing', () => {
    const record: DynamoDBRecord = { eventName: 'REMOVE', dynamodb: {} };
    const result = parsePhysicalRecord(record, 'evt-1');
    expect(result).toBeUndefined();
  });

  it('returns undefined for unrecognized entity types', () => {
    const record = makeDDBRecord('profiles', 'profile_p1', 'MODIFY', {});
    const result = parsePhysicalRecord(record, 'evt-1');
    expect(result).toBeUndefined();
  });
});

describe('buildEventsForRun', () => {
  beforeEach(() => {
    mockLapDao.listByRun.mockResolvedValue({ data: [], cursor: null } as never);
    mockEventDao.get.mockResolvedValue({ raceFormat: RaceFormat.BEST_LAP } as never);
  });

  it('emits RUN_STARTED on READY → IN_PROGRESS', async () => {
    const parsed = expectParsed(makeRunRecord('lb-1', 'run-1', RunStatus.IN_PROGRESS, RunStatus.READY), 'evt-1');
    const events = await buildEventsForRun(parsed);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'RUN_STARTED',
      eventId: 'evt-1',
      trackId: 'lb-1',
      racerId: 'racer-1',
      modelName: '',
      carName: '',
    });
  });

  it('does not emit RUN_STARTED for other transitions into IN_PROGRESS', async () => {
    const parsed = expectParsed(makeRunRecord('lb-1', 'run-1', RunStatus.IN_PROGRESS, RunStatus.PAUSED), 'evt-1');
    const events = await buildEventsForRun(parsed);
    expect(events).toHaveLength(0);
  });

  it('emits RUN_FINISHED on → SUBMITTED, sourcing laps from lapDao', async () => {
    mockLapDao.listByRun.mockResolvedValue({
      data: [
        { lapNumber: 1, lapTimeMs: 15000, isValid: true, resets: 0 },
        { lapNumber: 2, lapTimeMs: 14500, isValid: true, resets: 1 },
      ],
      cursor: null,
    } as never);
    const record = makeRunRecord('lb-1', 'run-1', RunStatus.SUBMITTED, RunStatus.IN_PROGRESS);
    const parsed = expectParsed(record, 'evt-1');
    const events = await buildEventsForRun(parsed);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'RUN_FINISHED',
      eventId: 'evt-1',
      trackId: 'lb-1',
      bestLapTimeMilliseconds: 14500,
      laps: [
        { lapNumber: 1, lapTimeMilliseconds: 15000, isValid: true, resets: 0 },
        { lapNumber: 2, lapTimeMilliseconds: 14500, isValid: true, resets: 1 },
      ],
    });
    expect(mockLapDao.listByRun).toHaveBeenCalledWith({ leaderboardId: 'lb-1', runId: 'run-1' });
  });

  it('scores RUN_FINISHED using AVERAGE_LAPS when the event is configured that way', async () => {
    mockEventDao.get.mockResolvedValue({ raceFormat: RaceFormat.AVERAGE_LAPS, averageLapsWindow: 2 } as never);
    mockLapDao.listByRun.mockResolvedValue({
      data: [
        { lapNumber: 1, lapTimeMs: 10000, isValid: true, resets: 0 },
        { lapNumber: 2, lapTimeMs: 20000, isValid: true, resets: 0 },
        { lapNumber: 3, lapTimeMs: 30000, isValid: true, resets: 0 },
      ],
      cursor: null,
    } as never);
    const record = makeRunRecord('lb-1', 'run-1', RunStatus.SUBMITTED, RunStatus.IN_PROGRESS);
    const parsed = expectParsed(record, 'evt-1');
    const events = await buildEventsForRun(parsed);
    // Average of the last 2 laps (window=2): (20000 + 30000) / 2 = 25000 — not min(laps) = 10000.
    expect(events[0]).toMatchObject({ eventType: 'RUN_FINISHED', bestLapTimeMilliseconds: 25000 });
  });

  it('does not emit events for non-transition records', async () => {
    const parsed = expectParsed(makeRunRecord('lb-1', 'run-1', RunStatus.READY), 'evt-1');
    const events = await buildEventsForRun(parsed);
    expect(events).toHaveLength(0);
  });

  it('handles no laps gracefully on RUN_FINISHED', async () => {
    const record = makeRunRecord('lb-1', 'run-1', RunStatus.SUBMITTED, RunStatus.IN_PROGRESS);
    const parsed = expectParsed(record, 'evt-1');
    const events = await buildEventsForRun(parsed);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: 'RUN_FINISHED', laps: [], bestLapTimeMilliseconds: 0 });
  });
});

describe('buildEventsForPhysicalRanking', () => {
  beforeEach(() => {
    mockRankingDao.listByRank.mockResolvedValue({
      data: [
        { rankingScore: 10000, userProfile: { alias: 'Alice' } },
        { rankingScore: 11000, userProfile: { alias: 'Bob' } },
        { rankingScore: 12000, userProfile: { alias: 'Charlie' } },
      ],
      cursor: null,
    } as never);
  });

  it('emits LEADERBOARD_UPDATED with ranked entries', async () => {
    const parsed = expectParsed(makeRankingRecord('lb-1', 'p-1'), 'evt-1');
    const events = await buildEventsForPhysicalRanking(parsed);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'LEADERBOARD_UPDATED',
      eventId: 'evt-1',
      trackId: 'lb-1',
      rankings: [
        { rank: 1, participantName: 'Alice', bestLapTimeMilliseconds: 10000 },
        { rank: 2, participantName: 'Bob', bestLapTimeMilliseconds: 11000 },
        { rank: 3, participantName: 'Charlie', bestLapTimeMilliseconds: 12000 },
      ],
    });
  });

  it('truncates to top-50 rankings', async () => {
    const rankings = Array.from({ length: 60 }, (_, i) => ({
      rankingScore: 10000 + i * 100,
      userProfile: { alias: `Racer${i}` },
    }));
    mockRankingDao.listByRank.mockResolvedValue({ data: rankings, cursor: null } as never);

    const parsed = expectParsed(makeRankingRecord('lb-1', 'p-1'), 'evt-1');
    const events = await buildEventsForPhysicalRanking(parsed);
    expect(events).toHaveLength(1);
    // Verify both: DAO received maxResults=50 AND the payload is actually truncated
    expect(mockRankingDao.listByRank).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 50 }));
    expect((events[0] as unknown as { rankings: unknown[] }).rankings).toHaveLength(50);
  });

  it('does not emit events for REMOVE operations', async () => {
    const record: DynamoDBRecord = {
      eventName: 'REMOVE',
      dynamodb: {
        SequenceNumber: '100000000000000000001',
        NewImage: {
          pk: { S: 'leaderboard_lb-1' },
          sk: { S: 'profile_p-1#ranking' },
          rankingScore: { N: '12000' },
        },
      },
    };
    const parsed = expectParsed(record, 'evt-1');
    const events = await buildEventsForPhysicalRanking(parsed);
    expect(events).toHaveLength(0);
  });

  it('queries rankingDao with correct leaderboardId and maxResults', async () => {
    const parsed = expectParsed(makeRankingRecord('lb-99', 'p-1'), 'evt-1');
    await buildEventsForPhysicalRanking(parsed);
    expect(mockRankingDao.listByRank).toHaveBeenCalledWith({
      leaderboardId: 'lb-99',
      maxResults: 50,
    });
  });
});

describe('buildEventsForEvent', () => {
  beforeEach(() => {
    mockLeaderboardDao.listByEventId.mockResolvedValue({
      data: [{ leaderboardId: 'track-1' }, { leaderboardId: 'track-2' }],
      cursor: null,
    } as never);
  });

  it('emits one RACE_STATUS_CHANGED per track on the event, on status transition', async () => {
    const parsed = expectParsed(makeEventRecord('evt-1', 'IN_PROGRESS', 'OPEN'), 'evt-1');
    const events = await buildEventsForEvent(parsed);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      eventType: 'RACE_STATUS_CHANGED',
      eventId: 'evt-1',
      trackId: 'track-1',
      status: 'IN_PROGRESS',
    });
    expect(events[1]).toMatchObject({
      eventType: 'RACE_STATUS_CHANGED',
      eventId: 'evt-1',
      trackId: 'track-2',
      status: 'IN_PROGRESS',
    });
    expect(mockLeaderboardDao.listByEventId).toHaveBeenCalledWith('evt-1');
  });

  it('emits nothing when the event currently has no tracks', async () => {
    mockLeaderboardDao.listByEventId.mockResolvedValue({ data: [], cursor: null } as never);
    const parsed = expectParsed(makeEventRecord('evt-1', 'IN_PROGRESS', 'OPEN'), 'evt-1');
    const events = await buildEventsForEvent(parsed);
    expect(events).toHaveLength(0);
  });

  it('does not emit when status is unchanged', async () => {
    const parsed = expectParsed(makeEventRecord('evt-1', 'OPEN', 'OPEN'), 'evt-1');
    const events = await buildEventsForEvent(parsed);
    expect(events).toHaveLength(0);
    expect(mockLeaderboardDao.listByEventId).not.toHaveBeenCalled();
  });

  it('does not emit for a status value outside the EventStatus enum', async () => {
    const parsed = expectParsed(makeEventRecord('evt-1', 'BOGUS_STATUS', 'OPEN'), 'evt-1');
    const events = await buildEventsForEvent(parsed);
    expect(events).toHaveLength(0);
  });

  it('emits on first insert (no old image)', async () => {
    const record: DynamoDBRecord = {
      eventName: 'INSERT',
      dynamodb: {
        SequenceNumber: '100',
        NewImage: {
          pk: { S: 'events' },
          sk: { S: 'event#evt-1' },
          eventStatus: { S: 'OPEN' },
        },
      },
    };
    const parsed = expectParsed(record, 'evt-1');
    const events = await buildEventsForEvent(parsed);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventType: 'RACE_STATUS_CHANGED', status: 'OPEN', trackId: 'track-1' });
  });
});

describe('buildPhysicalTopic', () => {
  it('constructs topic as racePrefix/{eventId}/{trackId}', () => {
    const topic = buildPhysicalTopic('deepracer/ns/race', 'evt-1', 'track-1');
    expect(topic).toBe('deepracer/ns/race/evt-1/track-1');
  });

  it('handles different prefix values', () => {
    const topic = buildPhysicalTopic('deepracer/prod/race', 'event-abc', 'lb-xyz');
    expect(topic).toBe('deepracer/prod/race/event-abc/lb-xyz');
  });
});
