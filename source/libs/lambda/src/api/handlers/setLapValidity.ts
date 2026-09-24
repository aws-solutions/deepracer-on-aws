// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { lapDao, runDao, type ResourceId } from '@deepracer-indy/database';
import {
  getSetLapValidityHandler,
  NotAuthorizedError,
  SetLapValidityServerInput,
  SetLapValidityServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { recalculateScoreIfSubmittedSafely } from '../utils/recalculateScoreIfSubmitted.js';
import { toLapResponse } from '../utils/toLapResponse.js';

export const SetLapValidityOperation: Operation<
  SetLapValidityServerInput,
  SetLapValidityServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const runId = input.runId as ResourceId;
  const { lapNumber, isValid } = input;

  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const run = await runDao.load({ leaderboardId, runId });

  // Throws NotFoundError if the lap does not exist.
  await lapDao.load({ leaderboardId, runId, lapNumber });

  const lapItem = await lapDao.partialUpdate({ leaderboardId, runId, lapNumber }, { isValid });

  // Cascades a score recalculation if the parent run has already been SUBMITTED.
  // undefined if not SUBMITTED, or if the cascade failed after the lap edit above already
  // persisted — see recalculateScoreIfSubmittedSafely's doc comment.
  const rankingScore = await recalculateScoreIfSubmittedSafely(run);

  metricsLogger.logLapValiditySet();

  return {
    lap: toLapResponse(lapItem),
    ...(rankingScore !== undefined && { rankingScore }),
  } satisfies SetLapValidityServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getSetLapValidityHandler(instrumentOperation(SetLapValidityOperation)),
);
