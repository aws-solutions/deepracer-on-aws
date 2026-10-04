// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { carLogFetchJobDao, carLogPaths } from '@deepracer-indy/database';
import {
  CarLogFetchStatus,
  CreateCarLogUploadServerInput,
  CreateCarLogUploadServerOutput,
  getCreateCarLogUploadHandler,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { getCarLogAccess, requireCarLogEnv } from '../utils/carLogAccess.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * `POST /car-logs/uploads` — create a job and a presigned URL to upload a `.tar.gz` of rosbag
 * directories by hand (any signed-in user except commentators). Finishing the upload to the
 * `staging/manual/` prefix starts the processing workflow through an S3 event; the archive is
 * checked and limited in size there, and logs are attributed through the model id in the
 * directory name; users can only add logs of their own models.
 */
export const CreateCarLogUploadOperation: Operation<
  CreateCarLogUploadServerInput,
  CreateCarLogUploadServerOutput,
  HandlerContext
> = async (_input, context) => {
  const { profileId } = context;
  const access = await getCarLogAccess(profileId);
  if (access === 'viewer') {
    throw new NotAuthorizedError({ message: 'Commentators cannot upload car logs.' });
  }
  const bucket = requireCarLogEnv('DEVICE_LOGS_BUCKET_NAME');

  const job = await carLogFetchJobDao.createJob({
    source: 'UPLOAD',
    status: CarLogFetchStatus.WAITING_FOR_UPLOAD,
    profileId,
    restrictToProfileId: access === 'racer' ? profileId : undefined,
  });
  const key = carLogPaths.manualUploadKey(job.jobId);

  const url = await s3Helper.getPresignedPutUrl(`s3://${bucket}/${key}`, UPLOAD_URL_TTL_SECONDS, 'application/gzip');
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

  logger.info('Car log upload created', { action: 'CAR_LOG_UPLOAD', jobId: job.jobId });
  return { jobId: job.jobId, url, expiresAt } satisfies CreateCarLogUploadServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getCreateCarLogUploadHandler(instrumentOperation(CreateCarLogUploadOperation)),
);
