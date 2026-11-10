// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { isLapReviewRequired, RUN_NOT_IN_PROGRESS_MESSAGE } from '@deepracer-indy/config';
import { lapDao, runDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  CreateLapServerInput,
  CreateLapServerOutput,
  getCreateLapHandler,
  LapReviewStatus,
  LapTimingSource,
  NotAuthorizedError,
  RunStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toLapResponse } from '../utils/toLapResponse.js';

export const CreateLapOperation: Operation<CreateLapServerInput, CreateLapServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const runId = input.runId as ResourceId;
  const deviceId = input.deviceId as ResourceId | undefined;
  const { lapTimeMs, resets, clientToken, missedCrossings } = input;
  const timingSource = input.timingSource ?? LapTimingSource.MANUAL;
  const reviewStatus = isLapReviewRequired({ timingSource, lapTimeMs, missedCrossings })
    ? LapReviewStatus.PENDING_REVIEW
    : LapReviewStatus.NOT_REQUIRED;

  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  const run = await runDao.load({ leaderboardId, runId });

  if (run.runStatus !== RunStatus.IN_PROGRESS) {
    throw new ConflictError({ message: RUN_NOT_IN_PROGRESS_MESSAGE });
  }

  // Atomically increments the Run's lapCount and creates the Lap item in one transaction —
  // throws ConflictError if the Run's lapCount has changed since this read, or the target
  // lap number already exists. Either way, the caller should retry with a fresh read.
  const lapItem = await lapDao.createNextLap({
    leaderboardId,
    runId,
    expectedLapCount: run.lapCount ?? 0,
    lapTimeMs,
    resets: resets ?? 0,
    deviceId,
    clientToken,
    timingSource,
    reviewStatus,
  });

  metricsLogger.logLapsRecorded();

  return { lap: toLapResponse(lapItem) } satisfies CreateLapServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getCreateLapHandler(instrumentOperation(CreateLapOperation)));
