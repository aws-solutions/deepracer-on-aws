// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import type { Operation } from '@aws-smithy/server-common';
import { bulkInviteJobDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  BulkInviteJobStatus,
  BulkInviteUserServerInput,
  BulkInviteUserServerOutput,
  ConflictError,
  getBulkInviteUserHandler,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { sfnClient } from '#utils/clients/sfnClient.js';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
/** CSV / batch cap. The Smithy model also enforces this. */
const MAX_ENTRIES = 200;
/** Default Cognito daily email send limit; overridable per deployment. */
const DEFAULT_COGNITO_DAILY_EMAIL_LIMIT = 50;

type BulkInviteEntries = BulkInviteUserServerInput['profiles'];

/**
 * Structural validation (defense in depth — the frontend already validates client-side and the
 * Smithy model bounds the list). Rejects the whole request; avoids echoing addresses into logs.
 */
function validateEntries(profiles: BulkInviteEntries): void {
  if (profiles.length === 0 || profiles.length > MAX_ENTRIES) {
    throw new BadRequestError({ message: `A bulk invite must contain between 1 and ${MAX_ENTRIES} entries.` });
  }
  const seenEmails = new Set<string>();
  for (const entry of profiles) {
    if (!EMAIL_REGEX.test(entry.emailAddress)) {
      throw new BadRequestError({ message: 'One or more entries has an invalid email address.' });
    }
    const normalized = entry.emailAddress.trim().toLowerCase();
    if (seenEmails.has(normalized)) {
      throw new BadRequestError({ message: 'The request contains duplicate email addresses.' });
    }
    seenEmails.add(normalized);
  }
}

/**
 * Email pre-flight: the default Cognito email sender is capped per day, so a large batch
 * would silently drop invitations. Reject up front and direct the admin to configure SES. The
 * limit guards against a missing OR non-numeric override (a NaN limit would disable the check).
 */
function assertWithinEmailQuota(entryCount: number): void {
  const usesDefaultCognitoEmail = process.env.EMAIL_DELIVERY_METHOD !== 'SES';
  const parsedLimit = Number(process.env.COGNITO_DAILY_EMAIL_LIMIT);
  const dailyEmailLimit = Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_COGNITO_DAILY_EMAIL_LIMIT;
  if (usesDefaultCognitoEmail && entryCount > dailyEmailLimit) {
    throw new BadRequestError({
      message:
        `This deployment uses the default Cognito email sender (limited to ${dailyEmailLimit} emails/day). ` +
        `Configure SES via the EmailDeliveryMethod deployment parameter before importing ${entryCount} users.`,
    });
  }
}

/**
 * Start the Step Functions execution for a created job. A same-token retry reuses the
 * deterministic execution name, so `ExecutionAlreadyExists` is treated as success (the execution
 * is already running). Any other failure marks the job FAILED (best-effort) so it does not sit
 * stuck in PROCESSING, then surfaces a 5xx.
 */
async function startBulkInviteExecution(params: {
  stateMachineArn: string;
  jobId: ResourceId;
  adminProfileId: ResourceId;
  profiles: BulkInviteEntries;
}): Promise<void> {
  const { stateMachineArn, jobId, adminProfileId, profiles } = params;
  try {
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: `bulk-invite-${jobId}`,
        input: JSON.stringify({
          jobId,
          adminProfileId,
          entries: profiles.map((entry, index) => ({
            index,
            emailAddress: entry.emailAddress,
            ...(entry.displayName === undefined ? {} : { displayName: entry.displayName }),
          })),
        }),
      }),
    );
  } catch (error) {
    if ((error as { name?: string })?.name === 'ExecutionAlreadyExists') {
      logger.info('Bulk invite execution already started (idempotent)', {
        action: 'BULK_INVITE_START_IDEMPOTENT',
        jobId,
      });
      return;
    }
    logger.error('Failed to start bulk invite execution', { action: 'BULK_INVITE_START_FAILURE', jobId, error });
    await bulkInviteJobDao
      .markTerminal({
        adminProfileId,
        bulkInviteJobId: jobId,
        status: BulkInviteJobStatus.FAILED,
        errorMessage: 'Failed to start processing.',
      })
      .catch(() => undefined);
    throw new InternalFailureError({ message: 'Failed to start the bulk invite. Please try again.' });
  }
}

/**
 * `POST /profiles/bulkInvite` — validate a bulk invite request, create a tracking job, and start
 * the Step Functions execution that onboards each racer. Admin-only. Returns 202
 * immediately with the job id to poll. The heavy lifting happens asynchronously in the
 * state machine — see the iteration Lambda and the ASL.
 */
export const BulkInviteUserOperation: Operation<
  BulkInviteUserServerInput,
  BulkInviteUserServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdmin(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can bulk-invite users.' });
  }

  const stateMachineArn = process.env.BULK_INVITE_STATE_MACHINE_ARN;
  if (!stateMachineArn) {
    logger.error('Missing required environment variable', { variable: 'BULK_INVITE_STATE_MACHINE_ARN' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  const { profiles, clientToken } = input;
  validateEntries(profiles);
  assertWithinEmailQuota(profiles.length);

  // Idempotent replay (Idempotency standard): if this token already created a job, return it
  // unchanged (no new job, no new Step Functions execution) rather than the one-active-job check
  // below turning a legitimate retry into a spurious 409. See createJob's doc comment: the token
  // is looked up via a dedicated guard item (BulkInviteJobTokenEntity), decoupled from the
  // Nano-ID-formatted `jobId` that Smithy's `@idempotencyToken` UUID can't satisfy directly.
  if (clientToken !== undefined) {
    const guard = await bulkInviteJobDao.getTokenGuard({ adminProfileId: profileId, clientToken });
    if (guard) {
      const existing = await bulkInviteJobDao.getById({
        adminProfileId: profileId,
        bulkInviteJobId: guard.bulkInviteJobId,
      });
      if (existing) {
        logger.info('Bulk invite idempotent replay', {
          action: 'BULK_INVITE_IDEMPOTENT_REPLAY',
          jobId: existing.bulkInviteJobId,
        });
        return { jobId: existing.bulkInviteJobId, status: existing.status, totalEntries: existing.totalEntries };
      }
      // The guard exists but its job could not be found (should not normally happen). Falling
      // through to createJob would just re-derive this same outcome the hard way: createJob's
      // create-with-token transaction would cancel on the pre-existing guard, re-fetch it, fail
      // to find the job again, and throw ConflictError (see BulkInviteJobDao.createJob). Throw
      // that same conflict directly here instead.
      throw new ConflictError({ message: 'A bulk invite with this idempotency token is already being processed.' });
    }
  }

  // One active job per admin, honouring the DAO's staleness escape hatch.
  if (await bulkInviteJobDao.hasActiveJob(profileId)) {
    throw new ConflictError({
      message: 'A bulk invite is already in progress. Wait for it to finish before starting another.',
    });
  }

  const job = await bulkInviteJobDao.createJob({
    adminProfileId: profileId,
    totalEntries: profiles.length,
    clientToken,
  });

  await startBulkInviteExecution({ stateMachineArn, jobId: job.bulkInviteJobId, adminProfileId: profileId, profiles });

  logger.info('Bulk invite started', {
    action: 'BULK_INVITE_START',
    jobId: job.bulkInviteJobId,
    totalEntries: job.totalEntries,
  });

  return { jobId: job.bulkInviteJobId, status: job.status, totalEntries: job.totalEntries };
};

// logEvent: false — the request body carries up to 200 email addresses; keep it out of the logs.
export const lambdaHandler = getApiGatewayHandler(
  getBulkInviteUserHandler(instrumentOperation(BulkInviteUserOperation)),
  { logEvent: false },
);
