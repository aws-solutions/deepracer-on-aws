// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, lapDao, LapItem, runDao, RunItem, type ResourceId } from '@deepracer-indy/database';
import {
  GetEventStatisticsServerInput,
  BadRequestError,
  GetEventStatisticsServerOutput,
  getGetEventStatisticsHandler,
  NotAuthorizedError,
  NotFoundError,
  RunStatus,
  UserGroups,
} from '@deepracer-indy/typescript-server-client';
import { mapWithConcurrency } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserMemberOf } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

// Limits concurrent lap queries when fanning out across an event's runs, consistent with
// the concurrency control used elsewhere for per-item DynamoDB fan-out (see MetricsDao).
const LAP_QUERY_CONCURRENCY = Number(process.env.DB_READ_CONCURRENCY ?? 10);

// Targets events with approximately 300 runs and 1,000 laps. Fetch one extra run
// so the handler can reject oversized events without scanning the full partition.
export const MAX_RUNS_FOR_STATISTICS = 300;

/**
 * Computes aggregate statistics for an event by querying every Run across every track
 * (via RunsEntity GSI2 byEventId) and every Lap for each of those runs, then reducing
 * them into the metrics.
 *
 * Lap queries are fetched in concurrency-limited chunks (LAP_QUERY_CONCURRENCY) rather
 * than all at once, to avoid a burst of concurrent DynamoDB queries against the byRunId
 * GSI at the design's stated maximum scale (~1000 laps across ~300 runs) while still
 * comfortably meeting the <5s budget.
 */
export const GetEventStatisticsOperation: Operation<
  GetEventStatisticsServerInput,
  GetEventStatisticsServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserMemberOf(profileId, [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.COMMENTATORS]))) {
    throw new NotAuthorizedError({
      message: 'Only administrators, facilitators, and commentators can view event statistics.',
    });
  }

  const eventId = input.eventId as ResourceId;

  // Confirm the event exists (and is visible) before doing the more expensive run/lap scan.
  try {
    await eventDao.load({ eventId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError({ message: error.message });
    }
    throw error;
  }

  const runs = await runDao.listAllByEvent({ eventId, maxResults: MAX_RUNS_FOR_STATISTICS + 1 });
  if (runs.length > MAX_RUNS_FOR_STATISTICS) {
    throw new BadRequestError({
      message: `Event statistics are limited to ${MAX_RUNS_FOR_STATISTICS} runs.`,
    });
  }

  const laps: LapItem[] = [];
  const lapsByRun = await mapWithConcurrency(runs, LAP_QUERY_CONCURRENCY, (run: RunItem) =>
    lapDao.listAllLapsByRun({ leaderboardId: run.leaderboardId, runId: run.runId }),
  );
  laps.push(...lapsByRun.flatMap(({ data }) => data));

  const totalRuns = runs.length;
  const completedRuns = runs.filter((run: RunItem) => run.runStatus === RunStatus.SUBMITTED).length;
  const discardedRuns = runs.filter((run: RunItem) => run.runStatus === RunStatus.DISCARDED).length;
  const validLaps = laps.filter((lap: LapItem) => lap.isValid);
  const totalValidLaps = validLaps.length;
  const uniqueRacerCount = new Set(runs.map((run: RunItem) => run.profileId)).size;

  const nonDiscardedRuns = totalRuns - discardedRuns;
  const completionRate = nonDiscardedRuns > 0 ? completedRuns / nonDiscardedRuns : 0;
  const averageLapsPerRun = totalRuns > 0 ? totalValidLaps / totalRuns : 0;

  const fastestLapMs = validLaps.length > 0 ? Math.min(...validLaps.map((lap: LapItem) => lap.lapTimeMs)) : undefined;
  const averageLapTimeMs =
    validLaps.length > 0
      ? validLaps.reduce((sum: number, lap: LapItem) => sum + lap.lapTimeMs, 0) / validLaps.length
      : undefined;

  return {
    statistics: {
      totalRuns,
      completedRuns,
      discardedRuns,
      totalValidLaps,
      averageLapsPerRun,
      uniqueRacerCount,
      completionRate,
      ...(fastestLapMs !== undefined && { fastestLapMs }),
      ...(averageLapTimeMs !== undefined && { averageLapTimeMs }),
    },
  } satisfies GetEventStatisticsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetEventStatisticsHandler(instrumentOperation(GetEventStatisticsOperation)),
);
