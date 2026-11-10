// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { profileDao, type ResourceId } from '@deepracer-indy/database';
import {
  BatchUpdateProfileQuotasError,
  BatchUpdateProfileQuotasServerInput,
  BatchUpdateProfileQuotasServerOutput,
  getBatchUpdateProfileQuotasHandler,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const PROFILE_UPDATE_CONCURRENCY = Number(process.env.PROFILE_UPDATE_CONCURRENCY ?? 10);

/**
 * Builds (and logs) a per-item error. A missing profile is bad input (warning); anything else is an unexpected
 * failure (error) with a generic message, and the details stay in the log.
 */
const toBatchError = (profileId: string, error: unknown): BatchUpdateProfileQuotasError => {
  const logContext = { action: 'QUOTA_UPDATE_FAILURE', profileId, error };
  if (error instanceof NotFoundError) {
    logger.warn('Failed to update profile quotas', logContext);
    return { profileId, code: error.name, message: 'Profile not found.' };
  }
  logger.error('Failed to update profile quotas', logContext);
  return {
    profileId,
    code: (error as { name?: string }).name ?? 'InternalFailure',
    message: 'Failed to update the profile quotas.',
  };
};

/**
 * `POST /profiles/batch-update-quotas`: sets the same usage quotas on up to 200 profiles (Administrators
 * only). The caller is authorized once, then each profile is updated independently with continue-on-failure,
 * in chunks that bound DynamoDB parallelism. Failures are returned per profile in `errors`.
 */
export const BatchUpdateProfileQuotasOperation: Operation<
  BatchUpdateProfileQuotasServerInput,
  BatchUpdateProfileQuotasServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId: performedBy } = context;
  if (!(await isUserAdmin(performedBy))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: performedBy });
    throw new NotAuthorizedError({ message: 'Only administrators can update usage quotas.' });
  }

  const { profileIds, maxTotalComputeMinutes, maxModelCount } = input;

  const applyQuotas = async (profileId: string): Promise<BatchUpdateProfileQuotasError | null> => {
    try {
      const key = { profileId: profileId as ResourceId };
      const previousProfile = await profileDao.load(key);
      const updatedProfile = await profileDao.update(key, { maxTotalComputeMinutes, maxModelCount });
      logger.info('QUOTA_UPDATE_AUDIT', {
        targetProfileId: profileId,
        performedBy,
        before: {
          maxTotalComputeMinutes: previousProfile.maxTotalComputeMinutes,
          maxModelCount: previousProfile.maxModelCount,
        },
        after: {
          maxTotalComputeMinutes: updatedProfile.maxTotalComputeMinutes,
          maxModelCount: updatedProfile.maxModelCount,
        },
      });
      return null;
    } catch (error) {
      return toBatchError(profileId, error);
    }
  };

  const updatedProfileIds: string[] = [];
  const errors: BatchUpdateProfileQuotasError[] = [];

  for (let i = 0; i < profileIds.length; i += PROFILE_UPDATE_CONCURRENCY) {
    const chunk = profileIds.slice(i, i + PROFILE_UPDATE_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(applyQuotas));
    chunk.forEach((profileId, idx) => {
      const error = chunkResults[idx];
      if (error) {
        errors.push(error);
      } else {
        updatedProfileIds.push(profileId);
      }
    });
  }

  logger.info('Batch profile quota update complete', {
    action: 'QUOTA_BATCH_UPDATE',
    performedBy,
    maxTotalComputeMinutes,
    maxModelCount,
    updated: updatedProfileIds.length,
    failed: errors.length,
  });

  return { updatedProfileIds, errors } satisfies BatchUpdateProfileQuotasServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getBatchUpdateProfileQuotasHandler(instrumentOperation(BatchUpdateProfileQuotasOperation)),
);
