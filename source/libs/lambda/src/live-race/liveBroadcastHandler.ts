// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import { leaderboardDao, liveQueueItemDao, rankingDao, type ResourceId } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-client';
import { logger } from '@deepracer-indy/utils';
import type { DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

const { IOT_ENDPOINT, TOPIC_PREFIX } = process.env;
if (!IOT_ENDPOINT || !TOPIC_PREFIX) {
  throw new Error('Missing required environment variables: IOT_ENDPOINT, TOPIC_PREFIX');
}

const iotClient = new IoTDataPlaneClient({ endpoint: `https://${IOT_ENDPOINT}` });

// --- Entity detection ---

type EntityType = 'LiveQueueItem' | 'Ranking' | 'Leaderboard' | 'Submission';

interface ParsedRecord {
  entityType: EntityType;
  leaderboardId: ResourceId;
  newImage: Record<string, { S?: string; N?: string; BOOL?: boolean; M?: Record<string, unknown> }>;
  oldImage?: Record<string, { S?: string; N?: string; BOOL?: boolean; M?: Record<string, unknown> }>;
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
}

export const parseRecord = (record: DynamoDBRecord): ParsedRecord | undefined => {
  const newImage = record.dynamodb?.NewImage;
  if (!newImage) return undefined;

  const pk = newImage.pk?.S ?? '';
  const sk = newImage.sk?.S ?? '';
  const eventName = record.eventName;
  if (eventName !== 'INSERT' && eventName !== 'MODIFY' && eventName !== 'REMOVE') return undefined;

  if (pk.includes('#livequeueitem')) {
    const leaderboardId = pk.split('#livequeueitem')[0].replace('leaderboard_', '') as ResourceId;
    return { entityType: 'LiveQueueItem', leaderboardId, newImage, oldImage: record.dynamodb?.OldImage, eventName };
  }

  if (sk.endsWith('#ranking')) {
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

// --- Main handler ---

const isLiveAndActive = (leaderboard: { isLive?: boolean; liveEventStatus?: string }): boolean =>
  leaderboard.isLive === true && leaderboard.liveEventStatus !== LiveEventStatus.COMPLETED;

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  const leaderboardCache = new Map<string, Awaited<ReturnType<typeof leaderboardDao.get>>>();

  for (const record of event.Records) {
    const parsed = parseRecord(record);
    if (!parsed) continue;

    try {
      let leaderboard;
      if (leaderboardCache.has(parsed.leaderboardId)) {
        leaderboard = leaderboardCache.get(parsed.leaderboardId);
      } else {
        leaderboard = await leaderboardDao.get({ leaderboardId: parsed.leaderboardId });
        leaderboardCache.set(parsed.leaderboardId, leaderboard);
      }
      if (!leaderboard) continue;

      // For Leaderboard entity changes, use the record itself (it IS the leaderboard)
      // For other entities, validate the leaderboard is live and active
      if (parsed.entityType !== 'Leaderboard' && !isLiveAndActive(leaderboard)) continue;

      let events: Array<Record<string, unknown>> = [];

      switch (parsed.entityType) {
        case 'LiveQueueItem':
          events = await buildEventsForLiveQueueItem(parsed);
          break;
        case 'Ranking':
          events = await buildEventsForRanking(parsed);
          break;
        case 'Leaderboard': {
          // Use stream record's newImage as authoritative for the Leaderboard record itself
          // (DAO is eventually consistent and may return stale data, and the cache could hold
          // stale state if earlier batch records populated it before this change arrived).
          const streamIsLive = parsed.newImage.isLive?.BOOL === true;
          if (!streamIsLive) continue;
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
          continue;
      }

      if (events.length > 0) {
        for (const evt of events) {
          await publishToIoT(parsed.leaderboardId, evt);
        }
        logger.info('Published events', { count: events.length, leaderboardId: parsed.leaderboardId });
      }
    } catch (error) {
      logger.error('Failed to process record', {
        error,
        entityType: parsed.entityType,
        leaderboardId: parsed.leaderboardId,
      });
      const sequenceNumber = record.dynamodb?.SequenceNumber;
      if (sequenceNumber) {
        batchItemFailures.push({ itemIdentifier: sequenceNumber });
      }
    }
  }

  return { batchItemFailures };
};

export const lambdaHandler = instrumentHandler(handler);
