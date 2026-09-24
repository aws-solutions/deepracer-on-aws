// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, leaderboardDao, type ResourceId } from '@deepracer-indy/database';
import {
  AddTrackToEventServerInput,
  AddTrackToEventServerOutput,
  ConflictError,
  EventStatus,
  getAddTrackToEventHandler,
  NotAuthorizedError,
  RaceType,
  TimingMethod,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { publishEmptyLeaderboardPlaceholder } from '../../live-race/publicLeaderboardS3.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const { PUBLIC_LEADERBOARD_BUCKET } = process.env;

/** Event lifecycle states that permit adding a track. */
const TRACK_ADDABLE_STATUSES: Set<EventStatus> = new Set<EventStatus>([EventStatus.DRAFT, EventStatus.OPEN]);

/** Maximum number of tracks (leaderboards) permitted per event. */
export const MAX_TRACKS_PER_EVENT = 10;

const TRACK_ORDER_WIDTH = 4;

const getNextTrackOrder = (trackOrders: Array<string | undefined>) => {
  const highestTrackOrder = trackOrders.reduce((highest, trackOrder) => {
    const order = Number(trackOrder);
    return Number.isInteger(order) && order > highest ? order : highest;
  }, 0);

  return String(highestTrackOrder + 1).padStart(TRACK_ORDER_WIDTH, '0');
};

/**
 * Pre-creates the public leaderboard's S3 hydration file(s) for a new track, before any race
 * exists — otherwise the first page load 404s and gets CloudFront's error-page substitution
 * cached for its full TTL, masking the real leaderboard once it's written. Writes the per-track
 * file, and the combined (event-wide) file if this is the event's first track. Best-effort: a
 * failure here must not block track creation, since the broadcast handler writes both files
 * again on every real race result regardless.
 */
const preCreatePublicLeaderboardFiles = async (
  leaderboardId: ResourceId,
  trackName: string | undefined,
  trackFooter: string | undefined,
  event: { eventId: ResourceId; name?: string; combinedLeaderBoardFooter?: string },
  isFirstTrackInEvent: boolean,
): Promise<void> => {
  if (!PUBLIC_LEADERBOARD_BUCKET) return;

  // Each write is independent so one's already-exists no-op can't block the other.
  const safePublishPlaceholder = async (id: ResourceId, name?: string, footer?: string): Promise<void> => {
    try {
      await publishEmptyLeaderboardPlaceholder(PUBLIC_LEADERBOARD_BUCKET, id, name, footer);
    } catch (error) {
      // A PreconditionFailed (IfNoneMatch: '*') means the file already exists — expected, not an error.
      if (error instanceof Error && error.name === 'PreconditionFailed') return;
      logger.error('Failed to pre-create public leaderboard S3 placeholder', { leaderboardId: id, error });
    }
  };

  await safePublishPlaceholder(leaderboardId, trackName, trackFooter);
  if (isFirstTrackInEvent) {
    await safePublishPlaceholder(event.eventId, event.name, event.combinedLeaderBoardFooter);
  }
};

export const AddTrackToEventOperation: Operation<
  AddTrackToEventServerInput,
  AddTrackToEventServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can add tracks to events.' });
  }

  const eventId = input.eventId as ResourceId;
  const { trackType, leaderBoardTitle, leaderBoardFooter } = input;
  const fleetId = input.fleetId as ResourceId | undefined;

  const event = await eventDao.load({ eventId });

  if (!TRACK_ADDABLE_STATUSES.has(event.eventStatus)) {
    throw new ConflictError({
      message: `Cannot add tracks: event is ${event.eventStatus}.`,
    });
  }

  const { data: existingTracks } = await leaderboardDao.listByEventId(eventId);

  if (existingTracks.length >= MAX_TRACKS_PER_EVENT) {
    throw new ConflictError({
      message: `Cannot add track: event already has the maximum of ${MAX_TRACKS_PER_EVENT} tracks.`,
    });
  }

  // LeaderboardsEntity still requires these virtual-race-only fields at the ElectroDB
  // layer (unrelated leaderboard-reading code paths assume they exist). Physical event
  // tracks don't use them for scoring — placeholder values below are never read by
  // Event Management (timekeeping computes scores from Laps, not from these fields).
  const leaderboardItem = await leaderboardDao.create({
    name: leaderBoardTitle,
    leaderBoardFooter,
    eventId,
    trackType,
    fleetId,
    trackOrder: getNextTrackOrder(existingTracks.map(({ trackOrder }) => trackOrder)),
    openTime: new Date(0).toISOString(),
    closeTime: new Date(0).toISOString(),
    raceType: RaceType.TIME_TRIAL,
    maxSubmissionsPerUser: 0,
    timingMethod: TimingMethod.BEST_LAP_TIME,
    submissionTerminationConditions: {
      maxLaps: 0,
    },
    resettingBehaviorConfig: {
      continuousLap: true,
    },
    trackConfig: {
      trackId: trackType,
      trackDirection: 'CLOCKWISE',
    },
  });

  await preCreatePublicLeaderboardFiles(
    leaderboardItem.leaderboardId,
    leaderBoardTitle,
    leaderBoardFooter,
    event,
    existingTracks.length === 0,
  );

  return { leaderboardId: leaderboardItem.leaderboardId } satisfies AddTrackToEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getAddTrackToEventHandler(instrumentOperation(AddTrackToEventOperation)),
);
