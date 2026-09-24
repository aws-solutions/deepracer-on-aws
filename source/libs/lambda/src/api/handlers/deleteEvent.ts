// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendMessageCommand } from '@aws-sdk/client-sqs';
import type { Operation } from '@aws-smithy/server-common';
import { eventDao, type ResourceId } from '@deepracer-indy/database';
import {
  DeleteEventServerInput,
  DeleteEventServerOutput,
  EventStatus,
  InternalFailureError,
  getDeleteEventHandler,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { sqsClient } from '../../utils/clients/sqsClient.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const enqueueEventDeletion = async (eventId: ResourceId, queueUrl: string): Promise<void> => {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ eventId }),
    }),
  );
};

/**
 * Initiates async deletion of an event. Permitted from any lifecycle state.
 *
 * Uses a conditional write (eventStatus <> DELETING) to atomically transition
 * the event to DELETING, eliminating the TOCTOU race between concurrent requests.
 * If the condition fails, the event is already DELETING — re-enqueue the deletion
 * message to recover from a prior enqueue failure, then return the idempotent
 * 202 response. The worker performs the leaves-first cascade asynchronously.
 */
export const DeleteEventOperation: Operation<DeleteEventServerInput, DeleteEventServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can delete events.' });
  }

  const eventId = input.eventId as ResourceId;
  const queueUrl = process.env.EVENT_DELETE_QUEUE_URL;
  if (!queueUrl) {
    throw new InternalFailureError({
      message: 'EVENT_DELETE_QUEUE_URL environment variable is not configured',
    });
  }

  try {
    await eventDao.transitionToDeleting(eventId);
  } catch (err) {
    const error = err as { name?: string; cause?: { name?: string } };
    if (error.name === 'ConditionalCheckFailedException' || error.cause?.name === 'ConditionalCheckFailedException') {
      // Already DELETING — re-enqueue for recovery if an earlier enqueue failed.
      await enqueueEventDeletion(eventId, queueUrl);
      return {
        eventId,
        status: EventStatus.DELETING,
        message: 'Event deletion already in progress.',
      } satisfies DeleteEventServerOutput;
    }
    throw err;
  }

  await enqueueEventDeletion(eventId, queueUrl);

  return {
    eventId,
    status: EventStatus.DELETING,
    message: 'Event deletion initiated. All associated data will be removed asynchronously.',
  } satisfies DeleteEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getDeleteEventHandler(instrumentOperation(DeleteEventOperation)));
