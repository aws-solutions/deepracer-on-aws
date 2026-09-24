// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { fleetDao } from '@deepracer-indy/database';
import {
  CreateFleetServerInput,
  CreateFleetServerOutput,
  getCreateFleetHandler,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** `POST /fleets` — create a fleet (Administrators and race facilitators). */
export const CreateFleetOperation: Operation<CreateFleetServerInput, CreateFleetServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators or race facilitators can create fleets.' });
  }

  const { name } = input.fleetDefinition;
  const fleet = await fleetDao.create({ name });

  return { fleetId: fleet.fleetId } satisfies CreateFleetServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getCreateFleetHandler(instrumentOperation(CreateFleetOperation)));
