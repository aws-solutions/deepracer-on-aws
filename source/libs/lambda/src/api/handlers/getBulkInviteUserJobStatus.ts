// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { ACTIVE_JOB_STALE_MS, bulkInviteJobDao, type ResourceId } from '@deepracer-indy/database';
import {
  BulkInviteEntryStatus,
  BulkInviteJobStatus,
  getGetBulkInviteUserJobStatusHandler,
  GetBulkInviteUserJobStatusServerInput,
  GetBulkInviteUserJobStatusServerOutput,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `GET /profiles/bulkInvite/{jobId}` — return the current state of a bulk invite job (polled by the
 * frontend every 3s). Admin-only. Job isolation (Security): the job's partition
 * key is the requesting admin's own profileId, so an admin can only read jobs they created — a
 * jobId belonging to another admin resolves to a different partition and simply misses (404). The
 * `progress` bar is derived client-side from `processedCount / totalEntries`.
 */
export const GetBulkInviteUserJobStatusOperation: Operation<
  GetBulkInviteUserJobStatusServerInput,
  GetBulkInviteUserJobStatusServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdmin(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can view bulk invite jobs.' });
  }

  const job = await bulkInviteJobDao.getById({
    adminProfileId: profileId,
    bulkInviteJobId: input.jobId as ResourceId,
  });
  if (!job) {
    throw new NotFoundError({ message: 'Bulk invite job not found.' });
  }

  // Derive EXPIRED for a stale PROCESSING record (older than the staleness horizon) so the frontend
  // gets a terminal state and stops polling, even when neither the state machine's Catch block nor a
  // cleanup write updated the record. hasActiveJob persists this transition
  // out-of-band on the next submission; deriving it on read keeps polls between the staleness
  // boundary and that write correct.
  const isStaleProcessing =
    job.status === BulkInviteJobStatus.PROCESSING && Date.now() - Date.parse(job.updatedAt) >= ACTIVE_JOB_STALE_MS;
  const status = isStaleProcessing ? BulkInviteJobStatus.EXPIRED : (job.status as BulkInviteJobStatus);

  return {
    status,
    totalEntries: job.totalEntries,
    processedCount: job.processedCount,
    createdCount: job.createdCount,
    skippedCount: job.skippedCount,
    failedCount: job.failedCount,
    results: job.results.map((result) => ({
      emailAddress: result.emailAddress,
      ...(result.displayName === undefined ? {} : { displayName: result.displayName }),
      status: result.status as BulkInviteEntryStatus,
      ...(result.reason === undefined ? {} : { reason: result.reason }),
    })),
    ...(job.errorMessage === undefined ? {} : { errorMessage: job.errorMessage }),
  } satisfies GetBulkInviteUserJobStatusServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getGetBulkInviteUserJobStatusHandler(instrumentOperation(GetBulkInviteUserJobStatusOperation)),
);
