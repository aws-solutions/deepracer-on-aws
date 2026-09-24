// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { lapDao, runDao, type ResourceId } from '@deepracer-indy/database';
import {
  getUpdateLapHandler,
  NotAuthorizedError,
  UpdateLapServerInput,
  UpdateLapServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { recalculateScoreIfSubmittedSafely } from '../utils/recalculateScoreIfSubmitted.js';
import { toLapResponse } from '../utils/toLapResponse.js';

/** Admin-only manual lap time edit. */
export const UpdateLapOperation: Operation<UpdateLapServerInput, UpdateLapServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const runId = input.runId as ResourceId;
  const { lapNumber, lapTimeMs, editReason } = input;

  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const run = await runDao.load({ leaderboardId, runId });

  // Throws NotFoundError if the lap does not exist.
  const existingLap = await lapDao.load({ leaderboardId, runId, lapNumber });

  // originalLapTimeMs is immutable after the first edit — preserve the pre-edit value only once.
  const originalLapTimeMs = existingLap.originalLapTimeMs ?? existingLap.lapTimeMs;
  const editedAt = new Date().toISOString();
  const editedBy = context.profileId;

  const updatedLap = await lapDao.partialUpdate(
    { leaderboardId, runId, lapNumber },
    { lapTimeMs, originalLapTimeMs, editedBy, editedAt, editReason },
  );

  logger.info('LAP_EDIT_AUDIT', {
    leaderboardId,
    runId,
    lapNumber,
    before: existingLap,
    after: updatedLap,
    editedBy,
    editReason,
  });

  metricsLogger.logLapEdited();

  // Cascades a score recalculation if the parent run has already been SUBMITTED.
  // undefined if not SUBMITTED, or if the cascade failed after the lap edit above already
  // persisted — see recalculateScoreIfSubmittedSafely's doc comment.
  const rankingScore = await recalculateScoreIfSubmittedSafely(run);

  return {
    lap: toLapResponse(updatedLap),
    ...(rankingScore !== undefined && { rankingScore }),
  } satisfies UpdateLapServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getUpdateLapHandler(instrumentOperation(UpdateLapOperation)));
