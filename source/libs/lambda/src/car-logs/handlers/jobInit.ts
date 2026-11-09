// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogFetchJobDao, carLogPaths, type ResourceId } from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { CarLogJobError } from '../utils/jobErrors.js';

export interface JobInitInput {
  /** Set when the workflow is started by the StartCarLogFetch API. */
  jobId?: string;
  /** Set when the workflow is started by an object arriving in the manual upload prefix. */
  uploadKey?: string;
}

export interface JobInitOutput {
  jobId: ResourceId;
  source: 'CAR' | 'UPLOAD';
}

/**
 * First step of the workflow. Resolves which job an execution belongs to and checks that the job
 * is in the expected state, so a replayed or forged event cannot start processing twice or for a
 * job that was never created through the API.
 */
const handler = async (input: JobInitInput): Promise<JobInitOutput> => {
  const jobId = (input.jobId ?? (input.uploadKey ? carLogPaths.jobIdFromUploadKey(input.uploadKey) : undefined)) as
    ResourceId | undefined;
  if (!jobId) {
    throw new CarLogJobError('The upload does not belong to a car log job.');
  }

  const job = await carLogFetchJobDao.load({ jobId });

  if (input.uploadKey && job.source !== 'UPLOAD') {
    throw new CarLogJobError('The upload is not expected for this job.');
  }

  if (job.source === 'UPLOAD') {
    const expectedKey = carLogPaths.manualUploadKey(jobId);
    if (input.uploadKey !== expectedKey || job.status !== CarLogFetchStatus.WAITING_FOR_UPLOAD) {
      logger.warn('Ignoring unexpected upload event', { jobId, status: job.status });
      throw new CarLogJobError('The upload is not expected for this job.');
    }
    await carLogFetchJobDao.updateStatus({
      jobId,
      status: CarLogFetchStatus.UPLOADED,
      attributes: { uploadKey: expectedKey },
    });
  } else if (job.status !== CarLogFetchStatus.CREATED) {
    throw new CarLogJobError('The fetch has already been started.');
  }

  return { jobId, source: job.source };
};

export const lambdaHandler = instrumentHandler(handler);
