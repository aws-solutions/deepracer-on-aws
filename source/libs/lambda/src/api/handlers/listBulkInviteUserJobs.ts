// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { ACTIVE_JOB_STALE_MS, bulkInviteJobDao } from '@deepracer-indy/database';
import {
  BulkInviteJobStatus,
  getListBulkInviteUserJobsHandler,
  ListBulkInviteUserJobsServerInput,
  ListBulkInviteUserJobsServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `GET /profiles/bulkInvite` — list the requesting admin's recent bulk invite jobs, most recent
 * first. Backs the frontend active-job-detection fallback when local storage is unavailable.
 * Admin-only, scoped to the caller's own profileId so an admin only sees
 * jobs they created (job isolation). A stale PROCESSING record is reported as EXPIRED at
 * read time so the frontend receives a terminal state and stops polling.
 */
export const ListBulkInviteUserJobsOperation: Operation<
  ListBulkInviteUserJobsServerInput,
  ListBulkInviteUserJobsServerOutput,
  HandlerContext
> = async (_input, context) => {
  const { profileId } = context;
  if (!(await isUserAdmin(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can view bulk invite jobs.' });
  }

  const now = Date.now();
  const jobs = await bulkInviteJobDao.listRecentByAdmin(profileId);

  return {
    jobs: jobs.map((job) => {
      const isStaleProcessing =
        job.status === BulkInviteJobStatus.PROCESSING && now - Date.parse(job.updatedAt) >= ACTIVE_JOB_STALE_MS;
      return {
        jobId: job.bulkInviteJobId,
        status: isStaleProcessing ? BulkInviteJobStatus.EXPIRED : (job.status as BulkInviteJobStatus),
        totalEntries: job.totalEntries,
        processedCount: job.processedCount,
        createdCount: job.createdCount,
        skippedCount: job.skippedCount,
        failedCount: job.failedCount,
        createdAt: job.createdAt,
      };
    }),
  } satisfies ListBulkInviteUserJobsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListBulkInviteUserJobsHandler(instrumentOperation(ListBulkInviteUserJobsOperation)),
);
