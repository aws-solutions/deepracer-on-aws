// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deploymentDao, eventDao, ResourceId } from '@deepracer-indy/database';
import {
  getListDeploymentsByEventHandler,
  ListDeploymentsByEventServerInput,
  ListDeploymentsByEventServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toDeploymentSummary } from '../utils/toDeploymentSummary.js';

/**
 * Lists deployments for an event, ordered by createdAt (paginated).
 * Queries GSI2 (PK=EVENT_{eventId}) after validating that the event is visible.
 * Restricted to Admin/Facilitator roles.
 */
export const ListDeploymentsByEventOperation: Operation<
  ListDeploymentsByEventServerInput,
  ListDeploymentsByEventServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only Admin or Facilitator users can view deployments.' });
  }

  const eventId = input.eventId as ResourceId;
  await eventDao.load({ eventId });

  const { cursor, data } = await deploymentDao.listByEvent({
    eventId,
    cursor: input.token,
    maxResults: input.maxResults ?? undefined,
  });

  return {
    eventId,
    deployments: data.map(toDeploymentSummary),
    token: cursor ?? undefined,
  } satisfies ListDeploymentsByEventServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListDeploymentsByEventHandler(instrumentOperation(ListDeploymentsByEventOperation)),
);
