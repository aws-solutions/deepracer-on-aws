// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  ELECTRO_DB_MAX_CONCURRENCY,
  lapDao,
  leaderboardDao,
  rankingDao,
  runDao,
  submissionDao,
  type ResourceId,
} from '@deepracer-indy/database';
import { logger, mapWithConcurrency, metrics } from '@deepracer-indy/utils';
import type { SQSHandler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

type EventDeleteMessage = {
  eventId: ResourceId;
};

class EventDeletionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'EventDeletionError';
  }
}

const parseMessage = (body: string): EventDeleteMessage => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new EventDeletionError('Event deletion message body is not valid JSON', error);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('eventId' in parsed) ||
    typeof parsed.eventId !== 'string' ||
    parsed.eventId.length === 0
  ) {
    throw new EventDeletionError('Event deletion message is missing a valid eventId');
  }

  return { eventId: parsed.eventId as ResourceId };
};

const assertNoUnprocessedItems = (entityName: string, unprocessedItems: readonly unknown[]): void => {
  if (unprocessedItems.length > 0) {
    throw new EventDeletionError(
      `Failed to delete ${unprocessedItems.length} ${entityName} items; SQS will retry the event`,
    );
  }
};

/** Limits concurrent lap queries to the same bound used by ElectroDB batch operations. */
export const LAP_QUERY_CONCURRENCY = ELECTRO_DB_MAX_CONCURRENCY;

/** Limits leaderboard-level fan-out to avoid multiplying DAO-internal delete concurrency. */
const LEADERBOARD_DELETE_CONCURRENCY = 2;

const deleteEventCascade = async (eventId: ResourceId): Promise<void> => {
  const event = await eventDao.get({ eventId });
  if (event === null || event === undefined) {
    logger.info('Event is already deleted; treating cascade as complete', { eventId });
    return;
  }

  const { data: leaderboards } = await leaderboardDao.listByEventId(eventId);
  const runs = await runDao.listAllByEvent({ eventId });

  const lapResults = await mapWithConcurrency(runs, LAP_QUERY_CONCURRENCY, ({ leaderboardId, runId }) =>
    lapDao.listAllLapsByRun({ leaderboardId, runId }),
  );
  const laps = lapResults.flatMap(({ data }) => data);

  if (laps.length > 0) {
    assertNoUnprocessedItems(
      'lap',
      await lapDao.batchDelete(
        laps.map(({ leaderboardId, runId, lapNumber }) => ({ leaderboardId, runId, lapNumber })),
      ),
    );
  }
  if (runs.length > 0) {
    assertNoUnprocessedItems(
      'run',
      await runDao.batchDelete(runs.map(({ leaderboardId, runId }) => ({ leaderboardId, runId }))),
    );
  }

  const rankingDeletes = await mapWithConcurrency(
    [{ leaderboardId: eventId }, ...leaderboards],
    LEADERBOARD_DELETE_CONCURRENCY,
    ({ leaderboardId }) => rankingDao.deleteByLeaderboardId(leaderboardId),
  );
  assertNoUnprocessedItems('ranking', rankingDeletes.flat());

  const submissionDeletes = await mapWithConcurrency(
    leaderboards,
    LEADERBOARD_DELETE_CONCURRENCY,
    ({ leaderboardId }) => submissionDao.deleteByLeaderboardId(leaderboardId),
  );
  assertNoUnprocessedItems('submission', submissionDeletes.flat());

  if (leaderboards.length > 0) {
    assertNoUnprocessedItems(
      'leaderboard',
      await leaderboardDao.batchDelete(leaderboards.map(({ leaderboardId }) => ({ leaderboardId }))),
    );
  }

  await eventDao.delete({ eventId });
  logger.info('Event cascade deletion completed', {
    eventId,
    leaderboardCount: leaderboards.length,
    runCount: runs.length,
  });
};

export const EventDeleteWorker: SQSHandler = async (event) => {
  try {
    for (const record of event.Records) {
      const { eventId } = parseMessage(record.body);
      await deleteEventCascade(eventId);
      metrics.addMetric('EventDeleteCompleted', 'Count', 1);
    }
  } catch (error) {
    metrics.addMetric('EventDeleteFailed', 'Count', 1);
    logger.error('Event cascade deletion failed; message will be retried', { error });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(EventDeleteWorker);

export { deleteEventCascade, parseMessage };
