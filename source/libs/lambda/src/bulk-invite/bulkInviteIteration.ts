// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { bulkInviteJobDao, type BulkInviteEntryResult, type ResourceId } from '@deepracer-indy/database';
import { BulkInviteEntryStatus } from '@deepracer-indy/typescript-server-client';
import { logger, metrics } from '@deepracer-indy/utils';

import {
  addUserToRacerGroup,
  createRacerCognitoUser,
  deleteCognitoUser,
  findCognitoUsernameByEmail,
  sanitizeDisplayNameToAlias,
} from '../api/utils/cognitoUserManagement.js';
import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

/** One entry as passed by the Step Functions Map state, plus the job context. */
export interface BulkInviteIterationInput {
  jobId: string;
  adminProfileId: string;
  entry: {
    index: number;
    emailAddress: string;
    displayName?: string;
  };
}

/** The per-entry outcome returned to the Map (also written to DynamoDB for polling). */
export interface BulkInviteIterationOutput extends BulkInviteEntryResult {
  index: number;
}

/** Cognito raises LimitExceededException when the daily email-send quota is exhausted. */
const isEmailQuotaError = (error: unknown): boolean => (error as { name?: string })?.name === 'LimitExceededException';

/**
 * Cognito raises UsernameExistsException / AliasExistsException from AdminCreateUser when another
 * execution created the same user first.
 */
const isAlreadyExistsError = (error: unknown): boolean => {
  const name = (error as { name?: string })?.name;
  return name === 'UsernameExistsException' || name === 'AliasExistsException';
};

const safeAddMetric = (name: string): void => {
  try {
    metrics.addMetric(name, MetricUnit.Count, 1);
  } catch (metricError) {
    logger.warn('Failed to publish bulk-invite metric', { name, metricError });
  }
};

/** Metric emitted per failed entry (alarmed on in the BulkInviteWorkflow construct). */
const METRIC_FAILED_ENTRIES = 'BulkInviteFailedEntries';
/** Structured-log action for a per-entry failure. */
const ACTION_ENTRY_FAILED = 'BULK_INVITE_ENTRY_FAILED';

/**
 * Process one bulk-invite entry (a single Step Functions Map iteration).
 */
const handler = async (input: BulkInviteIterationInput): Promise<BulkInviteIterationOutput> => {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    // A missing pool affects every entry — treat as a state-machine-level error (Map Catch → FAILED).
    logger.error('Missing required environment variable', { variable: 'USER_POOL_ID' });
    throw new Error('Service configuration error: USER_POOL_ID is not set.');
  }

  const { jobId, adminProfileId, entry } = input;
  const { index, emailAddress, displayName } = entry;
  const base = { emailAddress, ...(displayName === undefined ? {} : { displayName }) };

  let result: BulkInviteEntryResult;

  try {
    const existingUsername = await findCognitoUsernameByEmail(userPoolId, emailAddress);
    if (existingUsername) {
      result = await ensureExistingUserGrouped(userPoolId, existingUsername, base);
    } else {
      result = await createAndGroupUser(userPoolId, base);
    }
  } catch (error) {
    safeAddMetric(METRIC_FAILED_ENTRIES);
    logger.warn('Bulk-invite entry failed during existence check', { action: ACTION_ENTRY_FAILED, error });
    result = { ...base, status: BulkInviteEntryStatus.FAILED, reason: 'Failed to process entry' };
  }

  try {
    await bulkInviteJobDao.appendEntryResult({
      adminProfileId: adminProfileId as ResourceId,
      bulkInviteJobId: jobId as ResourceId,
      entryIndex: index,
      result,
    });
  } catch (error) {
    logger.error('Failed to persist bulk-invite entry result; recoverable from execution history', {
      action: 'BULK_INVITE_RESULT_PERSIST_FAILURE',
      jobId,
      index,
      error,
    });
  }

  return { index, ...result };
};

/**
 * The email already maps to a Cognito user.
 */
async function ensureExistingUserGrouped(
  userPoolId: string,
  username: string,
  base: { emailAddress: string; displayName?: string },
): Promise<BulkInviteEntryResult> {
  try {
    await addUserToRacerGroup(userPoolId, username);
  } catch (groupError) {
    // Count it like every other FAILED entry (HighFailureRate alarm) AND flag the ungrouped,
    // non-functional account for manual cleanup (OrphanedUser alarm).
    safeAddMetric(METRIC_FAILED_ENTRIES);
    safeAddMetric('BulkInviteOrphanedUser');
    logger.error('Existing bulk-invite user could not be assigned the racer group', {
      action: 'BULK_INVITE_ORPHANED_USER',
      groupError,
    });
    return {
      ...base,
      status: BulkInviteEntryStatus.FAILED,
      reason: 'User exists but group assignment failed; requires manual cleanup',
    };
  }
  safeAddMetric('BulkInviteUsersSkipped');
  return { ...base, status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' };
}

/** Create the Cognito user, send the invite, and assign the Racers group — with rollback. */
async function createAndGroupUser(
  userPoolId: string,
  base: { emailAddress: string; displayName?: string },
): Promise<BulkInviteEntryResult> {
  let username: string;
  try {
    username = await createRacerCognitoUser(
      userPoolId,
      base.emailAddress,
      sanitizeDisplayNameToAlias(base.displayName),
    );
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      const existingUsername = await findCognitoUsernameByEmail(userPoolId, base.emailAddress);
      if (existingUsername) {
        const grouped = await addUserToRacerGroup(userPoolId, existingUsername).then(
          () => true,
          () => false,
        );
        if (grouped) {
          safeAddMetric('BulkInviteUsersSkipped');
          return { ...base, status: BulkInviteEntryStatus.SKIPPED, reason: 'User already exists' };
        }
      }
      safeAddMetric(METRIC_FAILED_ENTRIES);
      logger.warn('Bulk-invite concurrent create not fully resolved; marking retryable FAILED', {
        action: ACTION_ENTRY_FAILED,
      });
      return {
        ...base,
        status: BulkInviteEntryStatus.FAILED,
        reason: 'Concurrent creation in progress — re-import to complete',
      };
    }
    safeAddMetric(METRIC_FAILED_ENTRIES);
    const reason = isEmailQuotaError(error)
      ? 'Email delivery quota exceeded — configure SES'
      : 'Failed to create the account';
    logger.warn('Bulk-invite entry failed at user creation', { action: ACTION_ENTRY_FAILED, reason });
    return { ...base, status: BulkInviteEntryStatus.FAILED, reason };
  }

  try {
    await addUserToRacerGroup(userPoolId, username);
  } catch (groupError) {
    safeAddMetric(METRIC_FAILED_ENTRIES);
    try {
      await deleteCognitoUser(userPoolId, username);
      logger.warn('Bulk-invite entry rolled back after group assignment failure', {
        action: ACTION_ENTRY_FAILED,
      });
      return { ...base, status: BulkInviteEntryStatus.FAILED, reason: 'Failed to assign the racer group' };
    } catch (rollbackError) {
      // The user was created but is not in any group and could not be deleted — non-functional
      // and requires manual cleanup. Alarmable (BulkInviteOrphanedUser).
      safeAddMetric('BulkInviteOrphanedUser');
      logger.error('Bulk-invite orphaned user: created but not grouped and rollback failed', {
        action: 'BULK_INVITE_ORPHANED_USER',
        groupError,
        rollbackError,
      });
      return {
        ...base,
        status: BulkInviteEntryStatus.FAILED,
        reason: 'Account created but group assignment failed and could not be rolled back; requires manual cleanup',
      };
    }
  }

  safeAddMetric('BulkInviteUsersCreated');
  return { ...base, status: BulkInviteEntryStatus.CREATED };
}

// logEvent: false — the event carries an email address; keep it out of the logs (no PII in logs).
export const lambdaHandler = instrumentHandler(handler, { logEvent: false });
