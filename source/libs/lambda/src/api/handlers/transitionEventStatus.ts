// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  EventStatus,
  EventTransitionAction,
  getTransitionEventStatusHandler,
  NotAuthorizedError,
  TransitionEventStatusServerInput,
  TransitionEventStatusServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** Valid state machine transitions: action → [required current status, resulting status] */
const TRANSITIONS: Record<EventTransitionAction, { from: EventStatus; to: EventStatus }> = {
  [EventTransitionAction.OPEN]: { from: EventStatus.DRAFT, to: EventStatus.OPEN },
  [EventTransitionAction.START]: { from: EventStatus.OPEN, to: EventStatus.IN_PROGRESS },
  [EventTransitionAction.COMPLETE]: { from: EventStatus.IN_PROGRESS, to: EventStatus.COMPLETED },
  [EventTransitionAction.ARCHIVE]: { from: EventStatus.COMPLETED, to: EventStatus.ARCHIVED },
};

export const TransitionEventStatusOperation: Operation<
  TransitionEventStatusServerInput,
  TransitionEventStatusServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can transition event status.' });
  }

  const eventId = input.eventId as ResourceId;
  const { action } = input;

  const transition = TRANSITIONS[action];

  try {
    await eventDao.transitionStatus(eventId, transition.from, transition.to);
  } catch (err) {
    const error = err as { name?: string; cause?: { name?: string } };
    if (error.name === 'ConditionalCheckFailedException' || error.cause?.name === 'ConditionalCheckFailedException') {
      // ConditionalCheckFailedException fires for two distinct cases:
      //   1. The event does not exist (DynamoDB patch on a non-existent item)
      //   2. The event exists but its status != transition.from (genuine conflict)
      // We distinguish them with a follow-up load so callers receive the correct
      // HTTP status (404 vs 409).
      await eventDao.load({ eventId }); // throws NotFoundError if the item is absent
      throw new ConflictError({
        message: `Cannot apply action ${action}. Event is not in ${transition.from} status.`,
      });
    }
    throw err;
  }

  metricsLogger.logEventLifecycleTransition({ from: transition.from, to: transition.to });

  return {
    eventId,
    status: transition.to,
  } satisfies TransitionEventStatusServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getTransitionEventStatusHandler(instrumentOperation(TransitionEventStatusOperation)),
);
