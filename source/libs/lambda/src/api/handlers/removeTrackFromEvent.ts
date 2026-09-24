// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, leaderboardDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  EventStatus,
  getRemoveTrackFromEventHandler,
  NotAuthorizedError,
  NotFoundError,
  RemoveTrackFromEventServerInput,
  RemoveTrackFromEventServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const RemoveTrackFromEventOperation: Operation<
  RemoveTrackFromEventServerInput,
  RemoveTrackFromEventServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can remove tracks from events.' });
  }

  const eventId = input.eventId as ResourceId;
  const leaderboardId = input.leaderboardId as ResourceId;

  const event = await eventDao.load({ eventId });

  if (event.eventStatus !== EventStatus.DRAFT) {
    throw new ConflictError({ message: 'Cannot remove track: event is not in DRAFT state.' });
  }

  const track = await leaderboardDao.load({ leaderboardId });

  if (track.eventId !== eventId) {
    throw new NotFoundError({ message: 'Track not found on this event.' });
  }

  if (track.submittedProfiles && track.submittedProfiles.length > 0) {
    throw new ConflictError({ message: 'Cannot remove track: track has existing runs.' });
  }

  const { data: existingTracks } = await leaderboardDao.listByEventId(eventId);

  if (existingTracks.length <= 1) {
    throw new ConflictError({ message: 'Cannot remove track: event must have at least one track.' });
  }

  await leaderboardDao.delete({ leaderboardId });

  return {} satisfies RemoveTrackFromEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getRemoveTrackFromEventHandler(instrumentOperation(RemoveTrackFromEventOperation)),
);
