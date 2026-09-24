// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, profileDao } from '@deepracer-indy/database';
import {
  CreateEventServerInput,
  CreateEventServerOutput,
  EventStatus,
  getCreateEventHandler,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const CreateEventOperation: Operation<CreateEventServerInput, CreateEventServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can create events.' });
  }

  const { eventDefinition } = input;

  // createdBy is an immutable alias snapshot of the requesting user (profiles are
  // created by the PreSignUp trigger, so the load cannot miss for an authenticated user).
  const profileItem = await profileDao.load({ profileId: context.profileId });

  const eventItem = await eventDao.create({
    name: eventDefinition.name,
    eventType: eventDefinition.eventType,
    eventStatus: EventStatus.DRAFT,
    eventDate: eventDefinition.eventDate,
    countryCode: eventDefinition.countryCode,
    raceFormat: eventDefinition.raceFormat,
    maxLaps: eventDefinition.maxLaps,
    maxTimeInMinutes: eventDefinition.maxTimeInMinutes,
    maxResets: eventDefinition.maxResets,
    sponsor: eventDefinition.sponsor,
    maxRunsPerRacer: eventDefinition.maxRunsPerRacer,
    combinedScoringStrategy: eventDefinition.combinedScoringStrategy,
    combinedLeaderBoardHeader: eventDefinition.combinedLeaderBoardHeader,
    combinedLeaderBoardFooter: eventDefinition.combinedLeaderBoardFooter,
    averageLapsWindow: eventDefinition.averageLapsWindow,
    createdBy: profileItem.alias,
  } as Parameters<typeof eventDao.create>[0]);

  metricsLogger.logEventsCreated();

  return { eventId: eventItem.eventId } satisfies CreateEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getCreateEventHandler(instrumentOperation(CreateEventOperation)));
