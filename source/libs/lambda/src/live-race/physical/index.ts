// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, lapDao, leaderboardDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import { RunStatus } from '@deepracer-indy/typescript-server-client';
import type { AttributeValue, DynamoDBRecord } from 'aws-lambda';

import {
  EventStatus,
  type LeaderboardRankingEntry,
  type LeaderboardUpdatedEvent,
  type PhysicalRaceEvent,
  type RunFinishedEvent,
  type RaceFinishedLap,
  type RunStartedEvent,
  type RaceStatusChangedEvent,
} from './types.js';
import { computeScoreFromLaps } from '../../api/utils/recalculateScoreIfSubmitted.js';

export { type PhysicalRaceEvent } from './types.js';

const MAX_LEADERBOARD_RANKINGS = 50;

const EVENT_PK = 'events';

export { EVENT_PK };

export const DDB_EVENT_NAMES = {
  INSERT: 'INSERT',
  MODIFY: 'MODIFY',
  REMOVE: 'REMOVE',
} as const;

const isEventStatus = (value: string): value is EventStatus =>
  Object.values(EventStatus).some((status) => status === value);

// --- DDB image attribute helpers (same pattern as the virtual handler) ---

type DDBImage = Record<string, AttributeValue>;

const attr = (image: DDBImage, key: string): string => image[key]?.S ?? '';

// --- Physical record detection ---

export type PhysicalEntityType = 'Run' | 'PhysicalRanking' | 'Event';

export interface ParsedPhysicalRecord {
  readonly entityType: PhysicalEntityType;
  /**
   * Empty string for 'Event' records — an Event has no single track of its own (it may span
   * zero or more tracks via the byEventId GSI), so this is resolved per-track in
   * buildEventsForEvent rather than at parse time.
   */
  readonly leaderboardId: ResourceId;
  readonly eventId: string;
  readonly newImage: DDBImage;
  readonly oldImage: DDBImage | undefined;
  readonly eventName: keyof typeof DDB_EVENT_NAMES;
}

/**
 * Attempts to parse a DDB stream record as a physical race entity.
 * Returns undefined if the record is not a physical entity.
 *
 * Detection keys (frozen contract):
 * - Run: SK is 'run_{runId}' (RunsEntity — no '#', leaderboardId lives in the PK only; ElectroDB
 *   forbids the same attribute in both PK and SK composites, see RunsEntity.ts)
 * - Physical Ranking: SK ends with '#ranking' AND leaderboard has eventId (discriminated upstream)
 * - Event: PK matches the Event key pattern (pk starts with 'events'), SK is 'event#{eventId}'
 */
export const parsePhysicalRecord = (
  record: DynamoDBRecord,
  leaderboardEventId: string | undefined,
): ParsedPhysicalRecord | undefined => {
  const newImage = record.dynamodb?.NewImage;
  if (!newImage || !record.eventName) return undefined;

  const pk = attr(newImage, 'pk');
  const sk = attr(newImage, 'sk');
  const eventName = record.eventName;
  const oldImage = record.dynamodb?.OldImage;

  // Run entity: SK is 'run_{runId}', PK is 'leaderboard_{leaderboardId}'
  if (sk.startsWith('run_')) {
    const leaderboardId = pk.replace('leaderboard_', '') as ResourceId;
    if (!leaderboardEventId) return undefined;
    return { entityType: 'Run', leaderboardId, eventId: leaderboardEventId, newImage, oldImage, eventName };
  }

  // Physical Ranking: SK ends with '#ranking' AND we have an eventId (discriminator)
  if (sk.endsWith('#ranking') && leaderboardEventId) {
    const leaderboardId = pk.replace('leaderboard_', '') as ResourceId;
    return {
      entityType: 'PhysicalRanking',
      leaderboardId,
      eventId: leaderboardEventId,
      newImage,
      oldImage,
      eventName,
    };
  }

  // Event entity: PK is the events partition, SK is 'event#{eventId}' (EventsEntity — '#',
  // not '_'). An Event has no track of its own; buildEventsForEvent resolves its tracks
  // via leaderboardDao.listByEventId and fans out one RACE_STATUS_CHANGED per track.
  if (pk === EVENT_PK) {
    const eventId = sk.replace('event#', '');
    return {
      entityType: 'Event',
      leaderboardId: '' as ResourceId,
      eventId,
      newImage,
      oldImage,
      eventName,
    };
  }

  return undefined;
};

// --- Event builders ---

/**
 * Builds events for a Run entity state transition.
 * - READY → IN_PROGRESS => RUN_STARTED
 * - → SUBMITTED => RUN_FINISHED (laps are queried from LapsEntity — RunsEntity carries no lap list)
 *
 * modelName/carName on RunStartedEvent are defaulted to '' — RunsEntity has no such fields
 * (only profileId), and no current frontend consumer reads them off this event.
 */
export const buildEventsForRun = async (parsed: ParsedPhysicalRecord): Promise<PhysicalRaceEvent[]> => {
  const { eventId, leaderboardId: trackId, newImage, oldImage } = parsed;
  const events: PhysicalRaceEvent[] = [];

  const newStatus = attr(newImage, 'runStatus');
  const oldStatus = oldImage ? attr(oldImage, 'runStatus') : '';

  // READY → IN_PROGRESS => RUN_STARTED
  if (newStatus === RunStatus.IN_PROGRESS && oldStatus === RunStatus.READY) {
    const event: RunStartedEvent = {
      eventType: 'RUN_STARTED',
      eventId,
      trackId,
      racerId: attr(newImage, 'profileId'),
      modelName: '',
      carName: '',
    };
    events.push(event);
  }

  // → SUBMITTED => RUN_FINISHED
  if (newStatus === RunStatus.SUBMITTED && oldStatus !== RunStatus.SUBMITTED) {
    const runId = attr(newImage, 'runId');
    const { data: lapItems } = await lapDao.listByRun({
      leaderboardId: trackId as ResourceId,
      runId: runId as ResourceId,
    });

    const laps: RaceFinishedLap[] = lapItems.map((lap) => ({
      lapNumber: lap.lapNumber,
      lapTimeMilliseconds: lap.lapTimeMs,
      isValid: lap.isValid,
      resets: lap.resets ?? 0,
    }));
    const validLapTimes = laps.filter((lap) => lap.isValid).map((lap) => lap.lapTimeMilliseconds);

    // Score per the event's configured race format (BEST_LAP vs AVERAGE_LAPS) — same
    // computation used by recalculateScoreIfSubmitted so RUN_FINISHED reports the same
    // score that will be persisted to the Submission/Ranking.
    const event = await eventDao.get({ eventId: eventId as ResourceId });
    const raceFormat = event?.raceFormat;
    const bestLapTimeMilliseconds =
      (raceFormat && computeScoreFromLaps(validLapTimes, raceFormat, event?.averageLapsWindow)) ?? 0;

    const finishedEvent: RunFinishedEvent = {
      eventType: 'RUN_FINISHED',
      eventId,
      trackId,
      racerId: attr(newImage, 'profileId'),
      laps,
      bestLapTimeMilliseconds,
    };
    events.push(finishedEvent);
  }

  return events;
};

/**
 * Builds LEADERBOARD_UPDATED event for physical ranking changes.
 * Queries current rankings via rankingDao and truncates to top-50.
 */
export const buildEventsForPhysicalRanking = async (parsed: ParsedPhysicalRecord): Promise<PhysicalRaceEvent[]> => {
  const { eventId, leaderboardId: trackId } = parsed;

  if (parsed.eventName === DDB_EVENT_NAMES.REMOVE) return [];

  const { data: rankings } = await rankingDao.listByRank({
    leaderboardId: trackId,
    maxResults: MAX_LEADERBOARD_RANKINGS,
  });

  const rankingEntries: LeaderboardRankingEntry[] = rankings.slice(0, MAX_LEADERBOARD_RANKINGS).map((r, i) => ({
    rank: i + 1,
    participantName: r.userProfile?.alias ?? '',
    bestLapTimeMilliseconds: r.rankingScore ?? 0,
    modelName: r.modelName ?? '',
    country: r.userProfile?.countryCode ?? '',
  }));

  const event: LeaderboardUpdatedEvent = {
    eventType: 'LEADERBOARD_UPDATED',
    eventId,
    trackId,
    rankings: rankingEntries,
  };

  return [event];
};

/**
 * Builds RACE_STATUS_CHANGED events for an Event entity status transition.
 * An event may have multiple tracks (or none yet) — Event carries no track of its own, so
 * this resolves the event's current tracks via the byEventId GSI and fans out one event per
 * track, each on its own race/{eventId}/{trackId} topic.
 */
export const buildEventsForEvent = async (parsed: ParsedPhysicalRecord): Promise<PhysicalRaceEvent[]> => {
  const { eventId, newImage, oldImage } = parsed;

  const newStatus = attr(newImage, 'eventStatus');
  const oldStatus = oldImage ? attr(oldImage, 'eventStatus') : '';

  if (newStatus === oldStatus || !isEventStatus(newStatus)) return [];

  const { data: leaderboards } = await leaderboardDao.listByEventId(eventId as ResourceId);

  return leaderboards.map((leaderboard): RaceStatusChangedEvent => ({
    eventType: 'RACE_STATUS_CHANGED',
    eventId,
    trackId: leaderboard.leaderboardId,
    status: newStatus,
  }));
};

/**
 * Processes a parsed physical record and returns the events to publish.
 */
export const buildPhysicalEvents = async (parsed: ParsedPhysicalRecord): Promise<PhysicalRaceEvent[]> => {
  switch (parsed.entityType) {
    case 'Run':
      return buildEventsForRun(parsed);
    case 'PhysicalRanking':
      return buildEventsForPhysicalRanking(parsed);
    case 'Event':
      return buildEventsForEvent(parsed);
    default:
      return [];
  }
};

/**
 * Builds the IoT topic for physical race events: race/{eventId}/{trackId}.
 */
export const buildPhysicalTopic = (raceTopicPrefix: string, eventId: string, trackId: string): string =>
  `${raceTopicPrefix}/${eventId}/${trackId}`;
