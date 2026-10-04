// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogFetchJobDao, type ResourceId } from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { failureMessageFromCause } from '../utils/jobErrors.js';

export interface JobFailInput {
  jobId: ResourceId;
  /** The `Error` and `Cause` Step Functions attaches to a caught failure. */
  error?: { Error?: string; Cause?: string };
}

/**
 * Catch target of the state machine: marks the job failed. It never throws, so the execution
 * always ends in its own failure state with the job already in a final status.
 */
const handler = async ({ jobId, error }: JobFailInput): Promise<{ jobId: ResourceId }> => {
  logger.error('Car log job failed', { jobId, error });
  try {
    await carLogFetchJobDao.updateStatus({
      jobId,
      status: CarLogFetchStatus.FAILED,
      errorMessage: failureMessageFromCause(error),
    });
  } catch (updateError) {
    // A job that already reached a final state, or a missing one, needs no change.
    logger.warn('Could not mark the job as failed', { jobId, updateError });
  }
  return { jobId };
};

export const lambdaHandler = instrumentHandler(handler);
