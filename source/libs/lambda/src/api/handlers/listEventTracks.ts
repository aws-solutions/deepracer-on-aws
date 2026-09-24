// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, leaderboardDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListEventTracksHandler,
  ListEventTracksServerInput,
  ListEventTracksServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toLeaderboardResponse } from '../utils/toLeaderboardResponse.js';

/**
 * Lists the tracks (Leaderboards) configured for an event. Backs the Event Detail
 * "Tracks" tab. Events are capped at MAX_TRACKS_PER_EVENT (10, see addTrackToEvent.ts),
 * so `listByEventId` fetches all pages internally — there is no meaningful client-facing
 * pagination boundary here, but `token` is still accepted/returned to keep the operation
 * shape consistent with the rest of the API surface.
 */
export const ListEventTracksOperation: Operation<
  ListEventTracksServerInput,
  ListEventTracksServerOutput,
  HandlerContext
> = async (input) => {
  const eventId = input.eventId as ResourceId;

  // Confirms the event exists; throws NotFoundError otherwise.
  await eventDao.load({ eventId });

  const { data: trackItems } = await leaderboardDao.listByEventId(eventId);

  return {
    tracks: trackItems.map(toLeaderboardResponse),
  } satisfies ListEventTracksServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListEventTracksHandler(instrumentOperation(ListEventTracksOperation)),
);
