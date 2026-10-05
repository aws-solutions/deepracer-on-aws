// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import {
  eventDao,
  leaderboardDao,
  liveQueueItemDao,
  rankingDao,
  ResourceType,
  type ResourceId,
} from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-client';
import { logger } from '@deepracer-indy/utils';
import type { DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

import { buildCarLogBroadcast } from './carLogBroadcast.js';
import { buildDeviceEvents, parseDeviceRecord, type ParsedDeviceRecord } from './deviceBroadcast.js';
import { recomputeCombinedLeaderboard } from './physical/combinedLeaderboard.js';
import {
  buildPhysicalEvents,
  buildPhysicalTopic,
  DDB_EVENT_NAMES,
  EVENT_PK,
  parsePhysicalRecord,
  type ParsedPhysicalRecord,
  type PhysicalRaceEvent,
} from './physical/index.js';
import { publishLeaderboardToS3 as publishLeaderboardToS3Impl, sanitizeDisplayField } from './publicLeaderboardS3.js';
import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

const { IOT_ENDPOINT, TOPIC_PREFIX, RACE_TOPIC_PREFIX, PUBLIC_LEADERBOARD_BUCKET, RACE_EVENT_BUS_NAME, NAMESPACE } =
  process.env;
if (!IOT_ENDPOINT || !TOPIC_PREFIX || !RACE_TOPIC_PREFIX || !PUBLIC_LEADERBOARD_BUCKET) {
  throw new Error(
    'Missing required environment variables: IOT_ENDPOINT, TOPIC_PREFIX, RACE_TOPIC_PREFIX, PUBLIC_LEADERBOARD_BUCKET',
  );
}

// Device routing (Task 11) is optional: absent env means device broadcast/pruning is disabled,
// keeping the shared handler backward compatible in contexts that don't set them.
const { DEVICE_TOPIC_PREFIX, PRUNER_FUNCTION_NAME, CAR_LOG_TOPIC_PREFIX } = process.env;

const iotClient = new IoTDataPlaneClient({ endpoint: `https://${IOT_ENDPOINT}` });
const lambdaClient = new LambdaClient({});
const eventBridgeClient = new EventBridgeClient({});

// --- Entity detection ---

/** SK suffix shared by both virtual and physical Ranking items (RANKING_KEY_TEMPLATE). */
const RANKING_SK_SUFFIX = `#${ResourceType.RANKING}`;

type EntityType = 'LiveQueueItem' | 'Ranking' | 'Leaderboard' | 'Submission';
type PhysicalRecordProcessResult = 'processed' | 'not-physical';

interface ParsedRecord {
  entityType: EntityType;
  leaderboardId: ResourceId;
  newImage: Record<string, { S?: string; N?: string; BOOL?: boolean; M?: Record<string, unknown> }>;
  oldImage?: Record<string, { S?: string; N?: string; BOOL?: boolean; M?: Record<string, unknown> }>;
  eventName: keyof typeof DDB_EVENT_NAMES;
}

export const parseRecord = (record: DynamoDBRecord): ParsedRecord | undefined => {
  const newImage = record.dynamodb?.NewImage;
  if (!newImage || !record.eventName) return undefined;

  const pk = newImage.pk?.S ?? '';
  const sk = newImage.sk?.S ?? '';
  const eventName = record.eventName;

  if (pk.includes('#livequeueitem')) {
    const leaderboardId = pk.split('#livequeueitem')[0].replace('leaderboard_', '') as ResourceId;
    return { entityType: 'LiveQueueItem', leaderboardId, newImage, oldImage: record.dynamodb?.OldImage, eventName };
  }

  if (sk.endsWith(RANKING_SK_SUFFIX)) {
    const leaderboardId = pk.replace('leaderboard_', '') as ResourceId;
    return { entityType: 'Ranking', leaderboardId, newImage, oldImage: record.dynamodb?.OldImage, eventName };
  }

  if (pk === 'leaderboards' && sk.startsWith('leaderboard_')) {
    const leaderboardId = sk.replace('leaderboard_', '') as ResourceId;
    return { entityType: 'Leaderboard', leaderboardId, newImage, oldImage: record.dynamodb?.OldImage, eventName };
  }

  if (pk.startsWith('profile_') && sk.includes('#submission_')) {
    const leaderboardId = sk.split('#submission_')[0].replace('leaderboard_', '') as ResourceId;
    return { entityType: 'Submission', leaderboardId, newImage, oldImage: record.dynamodb?.OldImage, eventName };
  }

  return undefined;
};

// --- Event builders ---

const ts = () => new Date().toISOString();

const attr = (image: Record<string, { S?: string; N?: string; BOOL?: boolean }>, key: string): string =>
  image[key]?.S ?? '';

const numAttr = (image: Record<string, { S?: string; N?: string; BOOL?: boolean }>, key: string): number =>
  Number(image[key]?.N ?? '0');

export const buildEventsForLiveQueueItem = async (parsed: ParsedRecord): Promise<Array<Record<string, unknown>>> => {
  const { leaderboardId, newImage, oldImage, eventName } = parsed;
  const events: Array<Record<string, unknown>> = [];
  const status = attr(newImage, 'status');
  const oldStatus = oldImage ? attr(oldImage, 'status') : '';
  const participantName = attr(newImage, 'participantName');
  const modelName = attr(newImage, 'modelName');
  const submissionId = attr(newImage, 'submissionId');
  const base = { leaderboardId, timestamp: ts() };

  // Status transition: → IN_PROGRESS
  if (status === 'IN_PROGRESS' && oldStatus !== 'IN_PROGRESS') {
    const queue = await liveQueueItemDao.getQueue({ leaderboardId });
    const totalModels = queue.length;
    const completedModels = queue.filter((item) => item.status === 'COMPLETED').length;
    const queuePosition = queue.findIndex((item) => item.submissionId === submissionId) + 1;
    events.push({
      ...base,
      eventType: 'EVALUATION_STARTED',
      participantName,
      modelName,
      submissionId,
      queuePosition,
      totalModels,
      completedModels,
    });
    events.push({
      ...base,
      eventType: 'PARTICIPANT_NOTIFICATION',
      profileId: attr(newImage, 'profileId'),
      notificationType: 'EVALUATION_STARTED',
      participantName,
      modelName,
      message: `${modelName} is now being evaluated`,
    });
  }

  // Status transition: → COMPLETED
  if (status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
    events.push({
      ...base,
      eventType: 'EVALUATION_COMPLETE',
      participantName,
      modelName,
      submissionId,
      results: {
        bestLapTime: numAttr(newImage, 'bestLapTime'),
        totalLapTime: numAttr(newImage, 'totalLapTime'),
        completedLapCount: numAttr(newImage, 'completedLapCount'),
        resetCount: numAttr(newImage, 'resetCount'),
        offTrackCount: numAttr(newImage, 'offTrackCount'),
      },
    });
    events.push({
      ...base,
      eventType: 'PARTICIPANT_NOTIFICATION',
      profileId: attr(newImage, 'profileId'),
      notificationType: 'EVALUATION_COMPLETE',
      participantName,
      modelName,
      message: `${modelName} evaluation complete`,
    });
  }

  // Queue position change or any status change → QUEUE_CHANGED (with new status for UI updates)
  const oldQueuePosition = oldImage ? attr(oldImage, 'queuePosition') : '';
  const newQueuePosition = attr(newImage, 'queuePosition');
  const statusChanged = oldStatus !== '' && oldStatus !== status;
  const positionChanged = oldQueuePosition !== '' && oldQueuePosition !== newQueuePosition;
  const queueChangedBase = {
    ...base,
    eventType: 'QUEUE_CHANGED',
    submissionId,
    participantName,
    newStatus: status,
    newQueuePosition,
  };

  if (eventName === 'INSERT') {
    events.push({ ...queueChangedBase, action: 'SUBMISSION_ADDED' });
  } else if (positionChanged) {
    events.push({ ...queueChangedBase, action: 'REORDER' });
  } else if (statusChanged) {
    events.push({ ...queueChangedBase, action: status === 'PENDING' ? 'RESET' : 'SKIP' });
  }

  return events;
};

export const buildEventsForRanking = async (parsed: ParsedRecord): Promise<Array<Record<string, unknown>>> => {
  const { leaderboardId, newImage } = parsed;
  const events: Array<Record<string, unknown>> = [];
  const base = { leaderboardId, timestamp: ts() };

  // Fetch full rankings for LEADERBOARD_UPDATED
  const { data: rankings } = await rankingDao.listByRank({ leaderboardId });
  events.push({
    ...base,
    eventType: 'LEADERBOARD_UPDATED',
    rankings: rankings.map((r, i) => ({
      rank: i + 1,
      participantName: r.userProfile?.alias ?? '',
      modelName: '',
      bestLapTime: r.rankingScore ?? 0,
      submissionId: '',
      avatar: r.userProfile?.avatar ?? {},
    })),
  });

  // Participant notifications for top performers
  const profileId = attr(newImage, 'profileId');
  const rankingScore = numAttr(newImage, 'rankingScore');
  const userProfileMap = newImage.userProfile?.M as Record<string, { S?: string }> | undefined;
  const participantName = userProfileMap?.alias?.S ?? '';

  // Find this participant's rank
  const rank = rankings.findIndex((r) => r.profileId === profileId) + 1;

  if (rank === 1) {
    events.push({
      ...base,
      eventType: 'PARTICIPANT_NOTIFICATION',
      profileId,
      notificationType: 'FASTEST_TIME',
      participantName,
      modelName: '',
      message: 'You have the fastest time!',
      results: { bestLapTime: rankingScore },
    });
  } else if (rank > 0 && rank <= 3) {
    events.push({
      ...base,
      eventType: 'PARTICIPANT_NOTIFICATION',
      profileId,
      notificationType: 'TOP_3',
      participantName,
      modelName: '',
      message: `You are ranked #${rank}!`,
      ranking: rank,
    });
  }

  return events;
};

export const buildEventsForLeaderboard = async (parsed: ParsedRecord): Promise<Array<Record<string, unknown>>> => {
  const { leaderboardId, newImage, oldImage } = parsed;
  const events: Array<Record<string, unknown>> = [];
  const base = { leaderboardId, timestamp: ts() };

  const newStatus = attr(newImage, 'liveEventStatus');
  const oldStatus = oldImage ? attr(oldImage, 'liveEventStatus') : '';

  if (newStatus !== oldStatus && newStatus !== '') {
    events.push({ ...base, eventType: 'RACE_STATUS_CHANGED', status: newStatus });

    // Winner declared: status → COMPLETED with winnerId
    const winnerId = attr(newImage, 'winnerId');
    if (newStatus === LiveEventStatus.COMPLETED && winnerId) {
      const { data: rankings } = await rankingDao.listByRank({
        leaderboardId,
        maxResults: 1,
      });
      const topRanking = rankings[0];
      events.push({
        ...base,
        eventType: 'WINNER_DECLARED',
        winnerId,
        winner: {
          participantName: topRanking?.userProfile?.alias ?? '',
          modelName: '',
          bestLapTime: topRanking?.rankingScore ?? 0,
          rank: 1,
          avatar: topRanking?.userProfile?.avatar ?? {},
        },
      });
    }
  }

  return events;
};

export const buildEventsForSubmission = (parsed: ParsedRecord): Array<Record<string, unknown>> => {
  const { leaderboardId, newImage, oldImage } = parsed;
  const events: Array<Record<string, unknown>> = [];
  const base = { leaderboardId, timestamp: ts() };

  const newUrl = attr(newImage, 'videoStreamUrl');
  const oldUrl = oldImage ? attr(oldImage, 'videoStreamUrl') : '';

  if (newUrl && newUrl !== oldUrl) {
    events.push({
      ...base,
      eventType: 'STREAM_READY',
      streamUrl: newUrl,
      participantName: attr(newImage, 'participantName') || attr(newImage, 'modelName'),
      modelName: attr(newImage, 'modelName'),
    });
  }

  return events;
};

// --- IoT Core publish ---

const IOT_MAX_PAYLOAD_BYTES = 128 * 1024;

export const publishToIoT = async (leaderboardId: ResourceId, event: Record<string, unknown>): Promise<void> => {
  const payload = { ...event, publishedAt: new Date().toISOString() };
  const encoded = Buffer.from(JSON.stringify(payload));

  if (encoded.byteLength > IOT_MAX_PAYLOAD_BYTES) {
    throw new Error(`IoT payload exceeds 128 KB (${encoded.byteLength} bytes) for leaderboard ${leaderboardId}`);
  }

  await iotClient.send(
    new PublishCommand({
      topic: `${TOPIC_PREFIX}/${leaderboardId}`,
      qos: 1,
      payload: encoded,
    }),
  );
};

/**
 * Publishes a physical race event to the race topic tree: race/{eventId}/{trackId}.
 * Truncation is handled upstream (top-50 for leaderboard); throws only as a last-resort guard.
 */
const publishToRaceTopic = async (eventId: string, trackId: string, event: PhysicalRaceEvent): Promise<void> => {
  const topic = buildPhysicalTopic(RACE_TOPIC_PREFIX, eventId, trackId);
  const payload = { ...event, publishedAt: new Date().toISOString() };
  const encoded = Buffer.from(JSON.stringify(payload));

  if (encoded.byteLength > IOT_MAX_PAYLOAD_BYTES) {
    throw new Error(`IoT payload exceeds 128 KB (${encoded.byteLength} bytes) for race topic ${topic}`);
  }

  await iotClient.send(
    new PublishCommand({
      topic,
      qos: 1,
      payload: encoded,
    }),
  );
};

// --- Device status/command routing + prune fan-out (Task 11) ---

/** Publish a device status/command event to the browser-facing device topic. No-op if unset. */
export const publishToDeviceTopic = async (instanceId: string, event: Record<string, unknown>): Promise<void> => {
  if (!DEVICE_TOPIC_PREFIX) return;
  const payload = { ...event, publishedAt: new Date().toISOString() };
  const encoded = Buffer.from(JSON.stringify(payload));
  if (encoded.byteLength > IOT_MAX_PAYLOAD_BYTES) {
    throw new Error(`IoT payload exceeds 128 KB (${encoded.byteLength} bytes) for device ${instanceId}`);
  }
  await iotClient.send(new PublishCommand({ topic: `${DEVICE_TOPIC_PREFIX}/${instanceId}`, qos: 1, payload: encoded }));
};

/** Publish a car log job/asset change to the browser-facing car log topics. No-op if unset. */
export const publishToCarLogTopic = async (topicSuffix: string, event: Record<string, unknown>): Promise<void> => {
  if (!CAR_LOG_TOPIC_PREFIX) return;
  const encoded = Buffer.from(JSON.stringify({ ...event, publishedAt: new Date().toISOString() }));
  await iotClient.send(
    new PublishCommand({ topic: `${CAR_LOG_TOPIC_PREFIX}/${topicSuffix}`, qos: 1, payload: encoded }),
  );
};

/**
 * Fan out TTL-expired device ids to the Pruning Lambda via async (`Event`) invoke — the
 * BroadcastHandler is not itself a stream consumer for pruning. Best-effort:
 * a pruning-invoke failure must not fail the broadcast batch.
 */
const dispatchPruneFanout = async (instanceIds: string[]): Promise<void> => {
  if (instanceIds.length === 0 || !PRUNER_FUNCTION_NAME) return;
  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: PRUNER_FUNCTION_NAME,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({ instanceIds })),
      }),
    );
    logger.info('Dispatched device prune fan-out', { count: instanceIds.length });
  } catch (error) {
    logger.error('Failed to invoke device pruner', { error, count: instanceIds.length });
  }
};

// --- S3 leaderboard JSON hydration ---
// Write logic lives in ./publicLeaderboardS3.js, shared with addTrackToEvent.ts. This wrapper
// keeps every call site's existing bucket-less call shape.

export const publishLeaderboardToS3 = (
  leaderboardId: ResourceId,
  leaderboardName?: string,
  leaderboardFooter?: string,
): Promise<void> =>
  publishLeaderboardToS3Impl(PUBLIC_LEADERBOARD_BUCKET, leaderboardId, leaderboardName, leaderboardFooter);

/**
 * Recomputes the combined (multi-track) leaderboard for a racer, then makes the combined standings
 * available to the unauthenticated public leaderboard via BOTH paths
 * ("S3 hydrate + IoT subscribe"):
 *   1. S3 — writes public/leaderboards/{eventId}.json for initial page hydration.
 *   2. IoT push — publishes LEADERBOARD_UPDATED to race/{eventId}/combined so subscribed spectators
 *      receive live updates (the spectator IoT policy already grants Subscribe on race/*).
 *
 * The combined leaderboard is stored as Ranking records keyed by leaderboardId = eventId.
 *
 * Isolated in its own error boundary: a failure here must never affect the per-track broadcast
 * that already completed.
 */
const COMBINED_TRACK_ID = 'combined';
const MAX_COMBINED_RANKINGS = 50;

const recomputeAndPublishCombinedLeaderboard = async (eventId: ResourceId, profileId: ResourceId): Promise<void> => {
  try {
    await recomputeCombinedLeaderboard(eventId, profileId);

    const event = await eventDao.get({ eventId });

    // 1. Hydration artifact for initial page load.
    await publishLeaderboardToS3(eventId, event?.name, event?.combinedLeaderBoardFooter);

    // 2. Publish the real-time update to the combined race topic.
    const { data: rankings } = await rankingDao.listByRank({
      leaderboardId: eventId,
      maxResults: MAX_COMBINED_RANKINGS,
    });
    const combinedEvent: PhysicalRaceEvent = {
      eventType: 'LEADERBOARD_UPDATED',
      eventId,
      trackId: COMBINED_TRACK_ID,
      rankings: rankings.slice(0, MAX_COMBINED_RANKINGS).map((r, i) => ({
        rank: i + 1,
        participantName: sanitizeDisplayField(r.userProfile?.alias),
        bestLapTimeMilliseconds: r.rankingScore ?? 0,
        modelName: sanitizeDisplayField(r.modelName),
        country: sanitizeDisplayField((r.userProfile as unknown as Record<string, string> | undefined)?.countryCode),
      })),
    };
    await publishToRaceTopic(eventId, COMBINED_TRACK_ID, combinedEvent);
  } catch (err) {
    logger.error('Failed to publish combined leaderboard', { eventId, err });
  }
};

// --- Main handler ---

const isLiveAndActive = (leaderboard: { isLive?: boolean; liveEventStatus?: string }): boolean =>
  leaderboard.isLive === true && leaderboard.liveEventStatus !== LiveEventStatus.COMPLETED;

type LeaderboardCache = Map<string, Awaited<ReturnType<typeof leaderboardDao.get>>>;

/**
 * Processes a single DynamoDB stream record: resolves the leaderboard, builds events,
 * and publishes them to IoT Core. Throws on unrecoverable errors.
 */
const processVirtualRecord = async (parsed: ParsedRecord, leaderboardCache: LeaderboardCache): Promise<void> => {
  let leaderboard;
  if (leaderboardCache.has(parsed.leaderboardId)) {
    leaderboard = leaderboardCache.get(parsed.leaderboardId);
  } else {
    leaderboard = await leaderboardDao.get({ leaderboardId: parsed.leaderboardId });
    leaderboardCache.set(parsed.leaderboardId, leaderboard);
  }
  if (!leaderboard) return;

  // For Leaderboard entity changes, use the record itself (it IS the leaderboard)
  // For other entities, validate the leaderboard is live and active
  if (parsed.entityType !== 'Leaderboard' && !isLiveAndActive(leaderboard)) return;

  let events: Array<Record<string, unknown>> = [];

  switch (parsed.entityType) {
    case 'LiveQueueItem':
      events = await buildEventsForLiveQueueItem(parsed);
      break;
    case 'Ranking':
      events = await buildEventsForRanking(parsed);
      // Secondary artifact — S3 failure must not block or retry the real-time IoT broadcast
      try {
        await publishLeaderboardToS3(parsed.leaderboardId, leaderboard.name, leaderboard.leaderBoardFooter);
      } catch (err) {
        logger.error('Failed to publish leaderboard to S3', { leaderboardId: parsed.leaderboardId, err });
      }
      break;
    case 'Leaderboard': {
      // Use stream record's newImage as authoritative for the Leaderboard record itself
      // (DAO is eventually consistent and may return stale data, and the cache could hold
      // stale state if earlier batch records populated it before this change arrived).
      const streamIsLive = parsed.newImage.isLive?.BOOL === true;
      if (!streamIsLive) return;
      leaderboardCache.set(parsed.leaderboardId, {
        ...leaderboard,
        isLive: streamIsLive,
        liveEventStatus: attr(parsed.newImage, 'liveEventStatus') as LiveEventStatus,
      });
      events = await buildEventsForLeaderboard(parsed);
      break;
    }
    case 'Submission':
      events = buildEventsForSubmission(parsed);
      break;
    default:
      return;
  }

  if (events.length > 0) {
    for (const evt of events) {
      await publishToIoT(parsed.leaderboardId, evt);
    }
    logger.info('Published events', { count: events.length, leaderboardId: parsed.leaderboardId });
  }
};

/**
 * Resolves a leaderboard from the cache, fetching from the DAO on a miss.
 */
const resolveFromCache = async (
  leaderboardId: ResourceId,
  leaderboardCache: LeaderboardCache,
): Promise<ReturnType<typeof leaderboardDao.get> | undefined> => {
  if (leaderboardCache.has(leaderboardId)) {
    return leaderboardCache.get(leaderboardId);
  }
  const leaderboard = await leaderboardDao.get({ leaderboardId });
  leaderboardCache.set(leaderboardId, leaderboard);
  return leaderboard;
};

/**
 * Handles REMOVE events for a Ranking item (e.g. rankingDao.deleteByLeaderboardId, invoked by
 * clearLiveLeaderboard/deleteLeaderboard). DynamoDB REMOVE stream records carry only an OldImage —
 * NewImage is absent — so this is handled independently of tryProcessPhysicalRecord/
 * parsePhysicalRecord, which are NewImage-only and would otherwise silently skip the deletion.
 *
 * Only the combined-leaderboard recompute is performed here (there is no per-track broadcast for
 * a Ranking deletion in either the physical or virtual path today). Returns true if handled.
 */
const tryRecomputeCombinedLeaderboardOnRankingRemove = async (
  record: DynamoDBRecord,
  leaderboardCache: LeaderboardCache,
): Promise<boolean> => {
  if (record.eventName !== DDB_EVENT_NAMES.REMOVE) return false;

  const oldImage = record.dynamodb?.OldImage;
  if (!oldImage) return false;

  const pk = attr(oldImage, 'pk');
  const sk = attr(oldImage, 'sk');
  if (!sk.endsWith(RANKING_SK_SUFFIX)) return false;

  const leaderboardId = pk.replace('leaderboard_', '') as ResourceId;
  const leaderboard = await resolveFromCache(leaderboardId, leaderboardCache);
  const leaderboardEventId =
    leaderboard && 'eventId' in leaderboard && typeof leaderboard.eventId === 'string'
      ? leaderboard.eventId
      : undefined;
  if (!leaderboardEventId) return false;

  const profileId = sk.replace(/^profile_/, '').slice(0, -RANKING_SK_SUFFIX.length) as ResourceId;
  await recomputeAndPublishCombinedLeaderboard(leaderboardEventId as ResourceId, profileId);
  return true;
};

/**
 * Hydration artifact for the per-track public leaderboard's initial page load — mirrors
 * processVirtualRecord's Ranking case. Without this, a physical track's S3 file is never
 * written, so a fresh page load shows no results until a live IoT event happens to land while a
 * spectator tab is already open. Isolated in its own error boundary: an S3 failure must never
 * block or delay the real-time IoT broadcast, which the caller has already completed by the time
 * this is invoked.
 *
 * leaderboardName/leaderboardFooter are the caller's already-resolved values for
 * parsed.leaderboardId (avoiding an extra, uncached DAO call) — only applied when evt.trackId is
 * that same leaderboard, since a future event type could in principle target a different track
 * within the same batch.
 */
const publishPhysicalLeaderboardToS3IfUpdated = async (
  evt: PhysicalRaceEvent,
  parsedLeaderboardId: ResourceId,
  leaderboardName: string | undefined,
  leaderboardFooter: string | undefined,
): Promise<void> => {
  if (evt.eventType !== 'LEADERBOARD_UPDATED') return;
  try {
    const isSameTrack = evt.trackId === parsedLeaderboardId;
    const nameForTrack = isSameTrack ? leaderboardName : undefined;
    const footerForTrack = isSameTrack ? leaderboardFooter : undefined;
    await publishLeaderboardToS3(evt.trackId as ResourceId, nameForTrack, footerForTrack);
  } catch (err) {
    logger.error('Failed to publish leaderboard to S3', { leaderboardId: evt.trackId, err });
  }
};

const publishPhysicalEvents = async (
  parsed: ParsedPhysicalRecord,
  extraLogFields?: Record<string, unknown>,
  leaderboardName?: string,
  leaderboardFooter?: string,
): Promise<void> => {
  const events = await buildPhysicalEvents(parsed);
  for (const evt of events) {
    // Use the event's own trackId, not parsed.leaderboardId — an Event record fans out to
    // multiple events across different tracks (see buildEventsForEvent), so there is no
    // single leaderboardId for the whole batch.
    await publishToRaceTopic(parsed.eventId, evt.trackId, evt);
    await publishPhysicalLeaderboardToS3IfUpdated(evt, parsed.leaderboardId, leaderboardName, leaderboardFooter);
  }

  // When a run is submitted, emit race-submitted to EventBridge to trigger stats rebuild (D5).
  const hasRunFinished = events.some((evt) => evt.eventType === 'RUN_FINISHED');
  if (hasRunFinished && RACE_EVENT_BUS_NAME) {
    try {
      const response = await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: RACE_EVENT_BUS_NAME,
              Source: `deepracer.${NAMESPACE}`,
              DetailType: 'race-submitted',
              Detail: JSON.stringify({ eventId: parsed.eventId, trackId: parsed.leaderboardId }),
            },
          ],
        }),
      );
      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        logger.error('Failed to emit race-submitted to EventBridge', {
          eventId: parsed.eventId,
          trackId: parsed.leaderboardId,
          failedEntries: response.Entries?.filter((e) => e.ErrorCode),
        });
      } else {
        logger.info('Emitted race-submitted to EventBridge', {
          eventId: parsed.eventId,
          trackId: parsed.leaderboardId,
        });
      }
    } catch (err) {
      // Non-fatal — stats rebuild failure must not affect the broadcast path
      logger.error('Failed to emit race-submitted to EventBridge', { err });
    }
  }

  if (events.length > 0) {
    logger.info('Published physical events', {
      count: events.length,
      entityType: parsed.entityType,
      ...extraLogFields,
    });
  }
};

/**
 * Attempts to process a record as a physical race entity.
 * Returns 'processed' if handled, 'not-physical' if the record should fall through to the virtual path.
 */
const tryProcessPhysicalRecord = async (
  record: DynamoDBRecord,
  leaderboardCache: LeaderboardCache,
): Promise<PhysicalRecordProcessResult> => {
  const newImage = record.dynamodb?.NewImage;
  if (!newImage) return 'not-physical';

  const pk = newImage.pk?.S ?? '';
  const sk = newImage.sk?.S ?? '';

  // Event entity: PK is the events partition (standalone, not leaderboard-scoped)
  if (pk === EVENT_PK) {
    const leaderboardEventId = sk.replace('event#', '');
    const parsed = parsePhysicalRecord(record, leaderboardEventId);
    if (!parsed) return 'not-physical';
    await publishPhysicalEvents(parsed, { eventId: leaderboardEventId });
    return 'processed';
  }

  // Run or Ranking: requires leaderboard-scoped PK with eventId discriminator
  if (!sk.startsWith('run_') && !sk.endsWith(RANKING_SK_SUFFIX)) return 'not-physical';

  const leaderboardId = pk.replace('leaderboard_', '') as ResourceId;
  const leaderboard = await resolveFromCache(leaderboardId, leaderboardCache);

  // If the leaderboard has no eventId, this is a virtual record — fall through.
  const leaderboardEventId =
    leaderboard && 'eventId' in leaderboard && typeof leaderboard.eventId === 'string'
      ? leaderboard.eventId
      : undefined;
  if (!leaderboardEventId) return 'not-physical';

  const parsed = parsePhysicalRecord(record, leaderboardEventId);
  if (!parsed) return 'not-physical';
  await publishPhysicalEvents(
    parsed,
    { eventId: leaderboardEventId, trackId: leaderboardId },
    leaderboard?.name,
    leaderboard?.leaderBoardFooter,
  );

  // Combined-leaderboard aggregation: isolated from per-track broadcast above —
  // recomputeCombinedLeaderboard never throws, so a failure here cannot affect the per-track
  // broadcast that already completed, nor mark this record as a batch item failure.
  if (parsed.entityType === 'PhysicalRanking' && sk.endsWith(RANKING_SK_SUFFIX)) {
    const profileId = sk.replace(/^profile_/, '').slice(0, -RANKING_SK_SUFFIX.length) as ResourceId;
    await recomputeAndPublishCombinedLeaderboard(leaderboardEventId as ResourceId, profileId);
  }

  return 'processed';
};

/** Shared per-record processing state threaded through the stream-record router. */
interface RecordProcessingContext {
  readonly leaderboardCache: LeaderboardCache;
  readonly pruneInstanceIds: string[];
  readonly batchItemFailures: Array<{ itemIdentifier: string }>;
}

/**
 * Record a stream record as a partial-batch failure so Lambda retries only it
 * (ReportBatchItemFailures). No-op when the record carries no sequence number.
 */
const recordBatchFailure = (record: DynamoDBRecord, batchItemFailures: Array<{ itemIdentifier: string }>): void => {
  const sequenceNumber = record.dynamodb?.SequenceNumber;
  if (sequenceNumber) {
    batchItemFailures.push({ itemIdentifier: sequenceNumber });
  }
};

/**
 * Handle a `device#` record (Task 11): collect TTL-deletes for the pruning fan-out, otherwise
 * publish its status/command events to the device topic. Sequential publish preserves ordering.
 */
const processDeviceRecord = async (deviceRecord: ParsedDeviceRecord, pruneInstanceIds: string[]): Promise<void> => {
  if (deviceRecord.isTtlDelete) {
    pruneInstanceIds.push(deviceRecord.instanceId);
    return;
  }
  for (const evt of buildDeviceEvents(deviceRecord)) {
    await publishToDeviceTopic(deviceRecord.instanceId, evt);
  }
};

/**
 * Route a single stream record through the paths in order — device → car log → ranking-remove → physical →
 * virtual — recording a batch failure on error. Extracted from {@link handler} so the handler's
 * loop body is a single call (keeps each function's cognitive complexity within the SonarQube
 * threshold).
 */
const processStreamRecord = async (record: DynamoDBRecord, ctx: RecordProcessingContext): Promise<void> => {
  const { leaderboardCache, pruneInstanceIds, batchItemFailures } = ctx;

  // Check for valid DDB Stream Event
  if (!record.eventName || !new Set(Object.keys(DDB_EVENT_NAMES)).has(record.eventName)) {
    return;
  }

  // Device records: distinct `device#` PK, so neither the physical nor virtual parsers claim them.
  const deviceRecord = parseDeviceRecord(record);
  if (deviceRecord) {
    try {
      await processDeviceRecord(deviceRecord, pruneInstanceIds);
    } catch (error) {
      logger.error('Failed to process device record', { error, instanceId: deviceRecord.instanceId });
      recordBatchFailure(record, batchItemFailures);
    }
    return;
  }

  // Car log job/asset records: distinct key prefixes, so no other path claims them.
  try {
    const carLog = buildCarLogBroadcast(record);
    if (carLog) {
      await publishToCarLogTopic(carLog.kind === 'job' ? 'jobs' : `assets/${carLog.profileId}`, carLog.event);
      return;
    }
  } catch (error) {
    logger.error('Failed to process car log record', { error });
    recordBatchFailure(record, batchItemFailures);
    return;
  }

  // REMOVE records carry only an OldImage — handle Ranking deletions (combined-leaderboard
  // recompute) independently of the NewImage-only physical/virtual routing below.
  try {
    if (await tryRecomputeCombinedLeaderboardOnRankingRemove(record, leaderboardCache)) return;
  } catch (error) {
    logger.error('Failed to process Ranking removal', { error });
    recordBatchFailure(record, batchItemFailures);
    return;
  }

  // Attempt physical record detection first; fall through to the virtual path when not physical.
  try {
    const physicalResult = await tryProcessPhysicalRecord(record, leaderboardCache);
    if (physicalResult === 'processed') return;
    // physicalResult === 'not-physical' — fall through to virtual path
  } catch (error) {
    logger.error('Failed to process physical record', { error });
    recordBatchFailure(record, batchItemFailures);
    return;
  }

  // Virtual path (existing logic)
  const parsed = parseRecord(record);
  if (!parsed) return;

  try {
    await processVirtualRecord(parsed, leaderboardCache);
  } catch (error) {
    logger.error('Failed to process record', {
      error,
      entityType: parsed.entityType,
      leaderboardId: parsed.leaderboardId,
    });
    recordBatchFailure(record, batchItemFailures);
  }
};

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  const leaderboardCache: LeaderboardCache = new Map();
  const pruneInstanceIds: string[] = [];

  for (const record of event.Records) {
    await processStreamRecord(record, { leaderboardCache, pruneInstanceIds, batchItemFailures });
  }

  await dispatchPruneFanout(pruneInstanceIds);

  return { batchItemFailures };
};

export const lambdaHandler = instrumentHandler(handler);
