// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, lapDao, leaderboardDao, rankingDao, runDao, submissionDao } from '@deepracer-indy/database';
import { metrics } from '@deepracer-indy/utils';
import type { SQSEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventDeleteWorker, LAP_QUERY_CONCURRENCY } from '../eventDeleteWorker.js';

const mockDaos = vi.hoisted(() => ({
  ELECTRO_DB_MAX_CONCURRENCY: 10,
  eventDao: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  leaderboardDao: {
    listByEventId: vi.fn(),
    batchDelete: vi.fn(),
  },
  runDao: {
    listAllByEvent: vi.fn(),
    batchDelete: vi.fn(),
  },
  lapDao: {
    listAllLapsByRun: vi.fn(),
    batchDelete: vi.fn(),
  },
  rankingDao: {
    deleteByLeaderboardId: vi.fn(),
  },
  submissionDao: {
    deleteByLeaderboardId: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/database', () => mockDaos);

const EVENT_ID = 'event-1';
const LEADERBOARD_ID = 'leaderboard-1';
const SECOND_LEADERBOARD_ID = 'leaderboard-2';
const RUN_ID = 'run-1';
const SECOND_RUN_ID = 'run-2';
const deletionOrder: string[] = [];
let activeLapQueries = 0;
let maxActiveLapQueries = 0;

const sqsEvent = (body: string): SQSEvent =>
  ({
    Records: [
      {
        body,
        messageId: 'message-1',
      },
    ],
  }) as SQSEvent;

describe('EventDeleteWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletionOrder.length = 0;
    activeLapQueries = 0;
    maxActiveLapQueries = 0;
    vi.spyOn(metrics, 'addMetric').mockImplementation(() => metrics);
    vi.mocked(eventDao.get).mockResolvedValue({ eventId: EVENT_ID } as never);
    vi.mocked(leaderboardDao.listByEventId).mockResolvedValue({
      data: [{ leaderboardId: LEADERBOARD_ID }, { leaderboardId: SECOND_LEADERBOARD_ID }],
    } as never);
    vi.mocked(runDao.listAllByEvent).mockResolvedValue([
      { leaderboardId: LEADERBOARD_ID, runId: RUN_ID },
      { leaderboardId: SECOND_LEADERBOARD_ID, runId: SECOND_RUN_ID },
    ] as never);
    vi.mocked(lapDao.listAllLapsByRun).mockImplementation(
      async ({ leaderboardId, runId }) =>
        ({
          data: [{ leaderboardId, runId, lapNumber: 1 }],
        }) as never,
    );
    vi.mocked(lapDao.batchDelete).mockImplementation(async () => {
      deletionOrder.push('laps');
      return [] as never;
    });
    vi.mocked(runDao.batchDelete).mockImplementation(async () => {
      deletionOrder.push('runs');
      return [] as never;
    });
    vi.mocked(rankingDao.deleteByLeaderboardId).mockImplementation(async () => {
      deletionOrder.push('rankings');
      return [] as never;
    });
    vi.mocked(submissionDao.deleteByLeaderboardId).mockImplementation(async () => {
      deletionOrder.push('submissions');
      return [] as never;
    });
    vi.mocked(leaderboardDao.batchDelete).mockImplementation(async () => {
      deletionOrder.push('leaderboards');
      return [] as never;
    });
    vi.mocked(eventDao.delete).mockImplementation(async () => {
      deletionOrder.push('event');
      return {} as never;
    });
  });

  it('deletes event data in leaves-first order and removes combined rankings', async () => {
    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(lapDao.batchDelete).toHaveBeenCalledWith([
      { leaderboardId: LEADERBOARD_ID, runId: RUN_ID, lapNumber: 1 },
      { leaderboardId: SECOND_LEADERBOARD_ID, runId: SECOND_RUN_ID, lapNumber: 1 },
    ]);
    expect(runDao.batchDelete).toHaveBeenCalledWith([
      { leaderboardId: LEADERBOARD_ID, runId: RUN_ID },
      { leaderboardId: SECOND_LEADERBOARD_ID, runId: SECOND_RUN_ID },
    ]);
    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledWith(EVENT_ID);
    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledWith(LEADERBOARD_ID);
    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledWith(SECOND_LEADERBOARD_ID);
    expect(submissionDao.deleteByLeaderboardId).toHaveBeenCalledWith(LEADERBOARD_ID);
    expect(submissionDao.deleteByLeaderboardId).toHaveBeenCalledWith(SECOND_LEADERBOARD_ID);
    expect(leaderboardDao.batchDelete).toHaveBeenCalledWith([
      { leaderboardId: LEADERBOARD_ID },
      { leaderboardId: SECOND_LEADERBOARD_ID },
    ]);
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });

    expect(deletionOrder).toEqual([
      'laps',
      'runs',
      'rankings',
      'rankings',
      'rankings',
      'submissions',
      'submissions',
      'leaderboards',
      'event',
    ]);
    expect(metrics.addMetric).toHaveBeenCalledWith('EventDeleteCompleted', 'Count', 1);
  });

  it('limits concurrent lap queries to the configured worker bound', async () => {
    const runs = Array.from({ length: LAP_QUERY_CONCURRENCY + 1 }, (_, index) => ({
      leaderboardId: LEADERBOARD_ID,
      runId: `run-${index}`,
    }));
    vi.mocked(runDao.listAllByEvent).mockResolvedValue(runs as never);
    vi.mocked(lapDao.listAllLapsByRun).mockImplementation(async () => {
      activeLapQueries += 1;
      maxActiveLapQueries = Math.max(maxActiveLapQueries, activeLapQueries);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeLapQueries -= 1;
      return { data: [] } as never;
    });

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(maxActiveLapQueries).toBe(LAP_QUERY_CONCURRENCY);
    expect(lapDao.listAllLapsByRun).toHaveBeenCalledTimes(runs.length);
  });

  it('treats an already deleted event as a successful retry', async () => {
    vi.mocked(eventDao.get).mockResolvedValue(null);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(leaderboardDao.listByEventId).not.toHaveBeenCalled();
    expect(eventDao.delete).not.toHaveBeenCalled();
    expect(metrics.addMetric).toHaveBeenCalledWith('EventDeleteCompleted', 'Count', 1);
  });

  it('deletes an event with no tracks without issuing empty batch deletes', async () => {
    vi.mocked(leaderboardDao.listByEventId).mockResolvedValue({ data: [] } as never);
    vi.mocked(runDao.listAllByEvent).mockResolvedValue([] as never);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(lapDao.batchDelete).not.toHaveBeenCalled();
    expect(runDao.batchDelete).not.toHaveBeenCalled();
    expect(leaderboardDao.batchDelete).not.toHaveBeenCalled();
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });
  });

  it('throws when a batch delete reports unprocessed items so SQS retries the message', async () => {
    vi.mocked(lapDao.batchDelete).mockResolvedValue([{ PutRequest: {} }] as never);

    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('Failed to delete 1 lap items; SQS will retry the event');

    expect(runDao.batchDelete).not.toHaveBeenCalled();
    expect(metrics.addMetric).toHaveBeenCalledWith('EventDeleteFailed', 'Count', 1);
  });

  it('resumes the cascade on SQS retry after a partial failure leaves laps deleted but runs intact', async () => {
    let runDeleteAttempts = 0;
    vi.mocked(runDao.batchDelete).mockImplementation(async () => {
      runDeleteAttempts += 1;
      deletionOrder.push('runs');
      if (runDeleteAttempts === 1) {
        throw new Error('ThrottlingException: simulated DynamoDB throttle');
      }
      return [] as never;
    });

    // First attempt: laps delete succeeds, run delete fails hard; the message must fail for SQS retry
    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('ThrottlingException: simulated DynamoDB throttle');

    expect(lapDao.batchDelete).toHaveBeenCalledTimes(1);
    expect(leaderboardDao.batchDelete).not.toHaveBeenCalled();
    expect(eventDao.delete).not.toHaveBeenCalled();
    expect(metrics.addMetric).toHaveBeenLastCalledWith('EventDeleteFailed', 'Count', 1);

    // SQS redelivers: laps are already gone, so the cascade must skip the empty lap batch delete and resume
    vi.mocked(lapDao.listAllLapsByRun).mockResolvedValue({ data: [] } as never);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(lapDao.batchDelete).toHaveBeenCalledTimes(1);
    expect(runDao.batchDelete).toHaveBeenCalledTimes(2);
    expect(leaderboardDao.batchDelete).toHaveBeenCalledWith([
      { leaderboardId: LEADERBOARD_ID },
      { leaderboardId: SECOND_LEADERBOARD_ID },
    ]);
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(deletionOrder).toEqual([
      'laps',
      'runs',
      'runs',
      'rankings',
      'rankings',
      'rankings',
      'submissions',
      'submissions',
      'leaderboards',
      'event',
    ]);
    expect(metrics.addMetric).toHaveBeenNthCalledWith(2, 'EventDeleteCompleted', 'Count', 1);
  });

  it('resumes downstream deletion after a partial submission failure', async () => {
    let submissionDeleteAttempts = 0;
    vi.mocked(submissionDao.deleteByLeaderboardId).mockImplementation(async () => {
      submissionDeleteAttempts += 1;
      deletionOrder.push('submissions');
      if (submissionDeleteAttempts === 2) {
        throw new Error('ThrottlingException: simulated submission throttle');
      }
      return [] as never;
    });

    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('ThrottlingException: simulated submission throttle');

    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledTimes(3);
    expect(submissionDao.deleteByLeaderboardId).toHaveBeenCalledTimes(2);
    expect(leaderboardDao.batchDelete).not.toHaveBeenCalled();
    expect(eventDao.delete).not.toHaveBeenCalled();

    // Laps, runs, and rankings were already removed by the failed attempt. The redelivery must
    // safely repeat those empty deletes, finish submissions, and then remove the parent records.
    vi.mocked(runDao.listAllByEvent).mockResolvedValue([] as never);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledTimes(6);
    expect(submissionDao.deleteByLeaderboardId).toHaveBeenCalledTimes(4);
    expect(leaderboardDao.batchDelete).toHaveBeenCalledWith([
      { leaderboardId: LEADERBOARD_ID },
      { leaderboardId: SECOND_LEADERBOARD_ID },
    ]);
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(metrics.addMetric).toHaveBeenNthCalledWith(2, 'EventDeleteCompleted', 'Count', 1);
  });

  it('resumes the cascade after a partial lap batch failure', async () => {
    let lapQueryCount = 0;
    let lapDeleteAttempts = 0;
    vi.mocked(lapDao.listAllLapsByRun).mockImplementation(async ({ leaderboardId, runId }) => {
      const isRetry = lapQueryCount >= 2;
      lapQueryCount += 1;
      const lapRemains = !isRetry || runId === RUN_ID;
      return {
        data: lapRemains ? [{ leaderboardId, runId, lapNumber: 1 }] : [],
      } as never;
    });
    vi.mocked(lapDao.batchDelete).mockImplementation(async () => {
      lapDeleteAttempts += 1;
      if (lapDeleteAttempts === 1) {
        return [{ PutRequest: {} }] as never;
      }
      return [] as never;
    });

    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('Failed to delete 1 lap items; SQS will retry the event');

    expect(runDao.batchDelete).not.toHaveBeenCalled();
    expect(eventDao.delete).not.toHaveBeenCalled();

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(lapDao.batchDelete).toHaveBeenCalledTimes(2);
    expect(lapDao.batchDelete).toHaveBeenLastCalledWith([
      { leaderboardId: LEADERBOARD_ID, runId: RUN_ID, lapNumber: 1 },
    ]);
    expect(runDao.batchDelete).toHaveBeenCalledTimes(1);
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(metrics.addMetric).toHaveBeenNthCalledWith(2, 'EventDeleteCompleted', 'Count', 1);
  });

  it('resumes the cascade after a partial ranking deletion', async () => {
    let rankingFailurePending = true;
    vi.mocked(rankingDao.deleteByLeaderboardId).mockImplementation(async (leaderboardId) => {
      deletionOrder.push('rankings');
      if (leaderboardId === SECOND_LEADERBOARD_ID && rankingFailurePending) {
        rankingFailurePending = false;
        return [{ PutRequest: {} }] as never;
      }
      return [] as never;
    });

    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('Failed to delete 1 ranking items; SQS will retry the event');

    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledTimes(3);
    expect(submissionDao.deleteByLeaderboardId).not.toHaveBeenCalled();
    expect(leaderboardDao.batchDelete).not.toHaveBeenCalled();
    expect(eventDao.delete).not.toHaveBeenCalled();

    // The leaves and runs were deleted before the ranking failure. The retry must repeat the
    // empty downstream deletes, finish rankings, and then continue through the parent records.
    vi.mocked(runDao.listAllByEvent).mockResolvedValue([] as never);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledTimes(6);
    expect(submissionDao.deleteByLeaderboardId).toHaveBeenCalledTimes(2);
    expect(leaderboardDao.batchDelete).toHaveBeenCalledWith([
      { leaderboardId: LEADERBOARD_ID },
      { leaderboardId: SECOND_LEADERBOARD_ID },
    ]);
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(metrics.addMetric).toHaveBeenNthCalledWith(2, 'EventDeleteCompleted', 'Count', 1);
  });

  it('resumes the cascade after a partial leaderboard deletion', async () => {
    let leaderboardDeleteAttempts = 0;
    vi.mocked(leaderboardDao.batchDelete).mockImplementation(async () => {
      leaderboardDeleteAttempts += 1;
      deletionOrder.push('leaderboards');
      if (leaderboardDeleteAttempts === 1) {
        return [{ PutRequest: {} }] as never;
      }
      return [] as never;
    });

    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('Failed to delete 1 leaderboard items; SQS will retry the event');

    expect(leaderboardDao.batchDelete).toHaveBeenCalledTimes(1);
    expect(eventDao.delete).not.toHaveBeenCalled();

    // All child records were deleted before the parent batch reported an unprocessed item.
    vi.mocked(runDao.listAllByEvent).mockResolvedValue([] as never);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(leaderboardDao.batchDelete).toHaveBeenCalledTimes(2);
    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledTimes(6);
    expect(submissionDao.deleteByLeaderboardId).toHaveBeenCalledTimes(4);
    expect(eventDao.delete).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(metrics.addMetric).toHaveBeenNthCalledWith(2, 'EventDeleteCompleted', 'Count', 1);
  });

  it('resumes the cascade after the event deletion fails', async () => {
    let eventDeleteAttempts = 0;
    vi.mocked(eventDao.delete).mockImplementation(async () => {
      eventDeleteAttempts += 1;
      deletionOrder.push('event');
      if (eventDeleteAttempts === 1) {
        throw new Error('ThrottlingException: simulated event throttle');
      }
      return {} as never;
    });

    await expect(
      EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined),
    ).rejects.toThrow('ThrottlingException: simulated event throttle');

    expect(leaderboardDao.batchDelete).toHaveBeenCalledTimes(1);
    expect(eventDao.delete).toHaveBeenCalledTimes(1);
    expect(metrics.addMetric).toHaveBeenLastCalledWith('EventDeleteFailed', 'Count', 1);

    // Every child and parent delete succeeded before the final event delete failed.
    vi.mocked(runDao.listAllByEvent).mockResolvedValue([] as never);

    await EventDeleteWorker(sqsEvent(JSON.stringify({ eventId: EVENT_ID })), {} as never, () => undefined);

    expect(leaderboardDao.batchDelete).toHaveBeenCalledTimes(2);
    expect(eventDao.delete).toHaveBeenCalledTimes(2);
    expect(eventDao.delete).toHaveBeenLastCalledWith({ eventId: EVENT_ID });
    expect(metrics.addMetric).toHaveBeenNthCalledWith(2, 'EventDeleteCompleted', 'Count', 1);
  });

  it('rejects malformed JSON message bodies', async () => {
    await expect(EventDeleteWorker(sqsEvent('not-json'), {} as never, () => undefined)).rejects.toThrow(
      'Event deletion message body is not valid JSON',
    );
    expect(eventDao.get).not.toHaveBeenCalled();
    expect(metrics.addMetric).toHaveBeenCalledWith('EventDeleteFailed', 'Count', 1);
  });

  it('rejects malformed messages', async () => {
    await expect(EventDeleteWorker(sqsEvent('{"eventId":""}'), {} as never, () => undefined)).rejects.toThrow(
      'Event deletion message is missing a valid eventId',
    );
    expect(eventDao.get).not.toHaveBeenCalled();
    expect(metrics.addMetric).toHaveBeenCalledWith('EventDeleteFailed', 'Count', 1);
  });
});
