// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, runDao, submissionDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  CreateRunServerInput,
  CreateRunServerOutput,
  EventStatus,
  getCreateRunHandler,
  NotAuthorizedError,
  RunStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toRunResponse } from '../utils/toRunResponse.js';

/** This is the implementation of business logic of the CreateRun operation. */
export const CreateRunOperation: Operation<CreateRunServerInput, CreateRunServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can create runs.' });
  }

  const eventId = input.eventId as ResourceId;
  const leaderboardId = input.leaderboardId as ResourceId;
  // profileId is intentionally taken from input, not context: facilitators create runs on behalf of racers
  // at physical events. The caller's own identity (context.profileId) is the facilitator, not the racer.
  const profileId = input.profileId as ResourceId;

  const eventItem = await eventDao.load({ eventId });

  if (eventItem.eventStatus !== EventStatus.IN_PROGRESS) {
    throw new ConflictError({ message: 'Event is not IN_PROGRESS.' });
  }

  const { data: submissionItems } = await submissionDao.listByCreatedAt({
    profileId,
    leaderboardId,
    maxResults: 1,
  });
  const numPreviousSubmissions = submissionItems[0]?.submissionNumber ?? 0;

  // maxRunsPerRacer is optional: absence means unlimited runs for this racer.
  if (eventItem.maxRunsPerRacer !== undefined && numPreviousSubmissions >= eventItem.maxRunsPerRacer) {
    throw new ConflictError({
      message: `Racer has exhausted maxRunsPerRacer (${eventItem.maxRunsPerRacer}) on this track.`,
    });
  }

  const runItem = await runDao.create({
    leaderboardId,
    eventId,
    profileId,
    racedByProxy: input.racedByProxy ?? false,
    runStatus: RunStatus.READY,
  } as Parameters<typeof runDao.create>[0]);

  return { run: toRunResponse(runItem) } satisfies CreateRunServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getCreateRunHandler(instrumentOperation(CreateRunOperation)));
