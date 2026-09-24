// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  lapDao,
  leaderboardDao,
  profileDao,
  raceStatsDao,
  runDao,
  type EventItem,
  type ResourceId,
} from '@deepracer-indy/database';
import { RunStatus } from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';
import type { EventBridgeEvent } from 'aws-lambda';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

const MAX_FASTEST_LAPS = 10;
const MAX_EVENTS_BY_COUNTRY = 249;
const MAX_EVENTS_BY_MONTH = 120;
const MAX_EVENT_TYPE_BREAKDOWN = 20;

type FastestLapCandidate = { participantName: string; lapTimeMs: number; eventId: string; eventName: string };

interface CountryStat {
  events: number;
  races: number;
  laps: number;
}
interface MonthStat {
  events: number;
  races: number;
  laps: number;
}

interface StatsAccumulator {
  leaderboardIds: Set<string>;
  racerIds: Set<string>;
  totalRaces: number;
  totalLaps: number;
  totalValidLaps: number;
  sumValidLapTimeMs: number;
  fastestLapCandidates: FastestLapCandidate[];
  // New aggregate maps — keyed by leaderboardId so we can join with event data
  racesByLeaderboard: Map<string, number>;
  lapsByLeaderboard: Map<string, number>;
}

const resolveParticipantName = async (profileId: ResourceId, cache: Map<string, string>): Promise<string> => {
  const cached = cache.get(profileId);
  if (cached !== undefined) return cached;
  let name: string;
  try {
    const profile = await profileDao.load({ profileId });
    name = profile?.alias ?? profileId;
  } catch {
    logger.warn('Could not load profile for stats rebuild', { profileId });
    name = profileId;
  }
  cache.set(profileId, name);
  return name;
};

const processLaps = async (
  acc: StatsAccumulator,
  leaderboardId: ResourceId,
  runId: ResourceId,
  participantName: string,
  eventName: string,
): Promise<void> => {
  const { data: laps } = await lapDao.listAllLapsByRun({ leaderboardId, runId });
  for (const lap of laps) {
    acc.totalLaps++;
    acc.lapsByLeaderboard.set(leaderboardId, (acc.lapsByLeaderboard.get(leaderboardId) ?? 0) + 1);
    if (lap.isValid) {
      acc.totalValidLaps++;
      acc.sumValidLapTimeMs += lap.lapTimeMs;
      // Use leaderboardId as eventId until LeaderboardsEntity gains eventId
      acc.fastestLapCandidates.push({ participantName, lapTimeMs: lap.lapTimeMs, eventId: leaderboardId, eventName });
    }
  }
};

const processRuns = async (
  acc: StatsAccumulator,
  leaderboardId: ResourceId,
  eventName: string,
  profileCache: Map<string, string>,
): Promise<void> => {
  let runCursor: string | null = null;
  do {
    const runPage = await runDao.list({ leaderboardId, cursor: runCursor, status: RunStatus.SUBMITTED });
    runCursor = runPage.cursor;

    for (const run of runPage.data) {
      acc.leaderboardIds.add(leaderboardId);
      acc.racerIds.add(run.profileId);
      acc.totalRaces++;
      acc.racesByLeaderboard.set(leaderboardId, (acc.racesByLeaderboard.get(leaderboardId) ?? 0) + 1);
      const participantName = await resolveParticipantName(run.profileId, profileCache);
      await processLaps(acc, leaderboardId, run.runId, participantName, eventName);
    }
  } while (runCursor !== null);
};

const collectAllStats = async (): Promise<StatsAccumulator> => {
  const acc: StatsAccumulator = {
    leaderboardIds: new Set(),
    racerIds: new Set(),
    totalRaces: 0,
    totalLaps: 0,
    totalValidLaps: 0,
    sumValidLapTimeMs: 0,
    fastestLapCandidates: [],
    racesByLeaderboard: new Map(),
    lapsByLeaderboard: new Map(),
  };
  const profileCache = new Map<string, string>();

  let leaderboardCursor: string | null = null;
  do {
    const leaderboardPage = await leaderboardDao.list({ cursor: leaderboardCursor });
    leaderboardCursor = leaderboardPage.cursor;
    for (const leaderboard of leaderboardPage.data) {
      await processRuns(acc, leaderboard.leaderboardId, leaderboard.name ?? leaderboard.leaderboardId, profileCache);
    }
  } while (leaderboardCursor !== null);

  return acc;
};

/**
 * Collect per-event aggregates (countryCode, eventType, createdAt) from EventsEntity.
 * Returns maps for building eventsByCountry, eventsByMonth, eventTypeBreakdown.
 */
const collectEventAggregates = async (
  acc: StatsAccumulator,
): Promise<{
  countryMap: Map<string, CountryStat>;
  monthMap: Map<string, MonthStat>;
  typeMap: Map<string, number>;
}> => {
  const countryMap = new Map<string, CountryStat>();
  const monthMap = new Map<string, MonthStat>();
  const typeMap = new Map<string, number>();

  let eventCursor: string | null = null;
  do {
    const eventPage = await eventDao.list({ cursor: eventCursor });
    eventCursor = (eventPage as { cursor: string | null }).cursor ?? null;

    for (const event of eventPage.data as EventItem[]) {
      const country = event.countryCode as string | undefined;
      const type = (event.eventType as string | undefined) ?? 'OTHER';
      const eventDate = (event.eventDate as string | undefined) ?? '';
      // Extract YYYY-MM from ISO date (eventDate is the semantic event date, not insertion time)
      // Skip events with missing or malformed eventDate — consistent with how eventsByCountry
      // skips events without a countryCode.
      const month = eventDate.length >= 7 ? eventDate.slice(0, 7) : undefined;
      const eventId = (event.eventId as string | undefined) ?? '';

      const eventRaces = acc.racesByLeaderboard.get(eventId) ?? 0;
      const eventLaps = acc.lapsByLeaderboard.get(eventId) ?? 0;

      // eventsByCountry — only include events with a known country code (skip unknown)
      if (country) {
        const existing = countryMap.get(country) ?? { events: 0, races: 0, laps: 0 };
        countryMap.set(country, {
          events: existing.events + 1,
          races: existing.races + eventRaces,
          laps: existing.laps + eventLaps,
        });
      }

      // eventsByMonth — skip events with missing or malformed eventDate
      if (month) {
        const existingMonth = monthMap.get(month) ?? { events: 0, races: 0, laps: 0 };
        monthMap.set(month, {
          events: existingMonth.events + 1,
          races: existingMonth.races + eventRaces,
          laps: existingMonth.laps + eventLaps,
        });
      }

      // eventTypeBreakdown
      typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
    }
  } while (eventCursor !== null);

  return { countryMap, monthMap, typeMap };
};

/**
 * EventBridge-triggered Lambda that performs a full recompute of global RaceStats.
 *
 * Triggered by a 'race-submitted' event emitted by BroadcastHandler when a Run
 * transitions to SUBMITTED. Full recompute (no incremental RMW) so concurrent
 * submissions cannot lose updates. Rebuild is async and off the broadcast latency
 * path; EventBridge provides retry + DLQ.
 *
 * Known scaling limitation: O(all races) per submission — revisit with incremental
 * aggregation if p50 rebuild crosses the 60s alarm threshold.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StatsRebuild = async (event: EventBridgeEvent<'race-submitted', any>): Promise<void> => {
  logger.info('Stats rebuild triggered', { source: event.source, detailType: event['detail-type'] });

  const acc = await collectAllStats();
  const { countryMap, monthMap, typeMap } = await collectEventAggregates(acc);

  const fastestLapsEver = acc.fastestLapCandidates
    .toSorted((a, b) => a.lapTimeMs - b.lapTimeMs)
    .slice(0, MAX_FASTEST_LAPS)
    .map((lap) => ({
      participantName: lap.participantName,
      lapTimeMilliseconds: lap.lapTimeMs,
      eventId: lap.eventId,
      eventName: lap.eventName,
    }));

  const eventsByCountry = [...countryMap.entries()]
    .map(([countryCode, stat]) => ({ countryCode, ...stat }))
    .sort((a, b) => b.events - a.events)
    .slice(0, MAX_EVENTS_BY_COUNTRY);

  const eventsByMonth = [...monthMap.entries()]
    .map(([month, stat]) => ({ month, ...stat }))
    .sort((a, b) => b.month.localeCompare(a.month)) // newest first
    .slice(0, MAX_EVENTS_BY_MONTH) // keep most recent months
    .sort((a, b) => a.month.localeCompare(b.month)); // re-sort ascending for display

  const eventTypeBreakdown = [...typeMap.entries()]
    .map(([typeOfEvent, count]) => ({ typeOfEvent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_EVENT_TYPE_BREAKDOWN);

  await raceStatsDao.putGlobal({
    totalEvents: acc.leaderboardIds.size,
    totalRacers: acc.racerIds.size,
    totalRaces: acc.totalRaces,
    totalLaps: acc.totalLaps,
    totalValidLaps: acc.totalValidLaps,
    sumValidLapTimeMs: acc.sumValidLapTimeMs,
    fastestLapsEver,
    totalCountries: countryMap.size,
    eventsByCountry,
    eventsByMonth,
    eventTypeBreakdown,
  });

  // Report anonymized aggregate counts only — no participant names, no per-race
  // identifiers. Isolated from the rebuild itself: a metrics failure must never fail or retry
  // the rebuild that just completed above.
  try {
    metricsLogger.logRaceManagementStatsRebuilt({
      totalEvents: acc.leaderboardIds.size,
      totalRacers: acc.racerIds.size,
      totalRaces: acc.totalRaces,
      totalLaps: acc.totalLaps,
      totalValidLaps: acc.totalValidLaps,
      totalCountries: countryMap.size,
    });
  } catch (error) {
    logger.error('Failed to report race management stats telemetry', { error });
  }

  logger.info('Stats rebuild complete', {
    totalEvents: acc.leaderboardIds.size,
    totalRacers: acc.racerIds.size,
    totalRaces: acc.totalRaces,
    totalCountries: countryMap.size,
    eventTypeBreakdown: eventTypeBreakdown.length,
  });
};

export const lambdaHandler = instrumentHandler(StatsRebuild);
