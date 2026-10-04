// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SendCommandCommand } from '@aws-sdk/client-ssm';
import { carLogFetchJobDao, carLogPaths, type ResourceId } from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import { ssmClient } from '../../utils/clients/ssmClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import { CarLogJobError } from '../utils/jobErrors.js';
import { buildCarLogUploadScript } from '../utils/ssmScripts.js';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
/** The on-car script gets as long as the upload URL stays valid. */
const COMMAND_TIMEOUT_SECONDS = 30 * 60;

export interface JobSendCommandOutput {
  jobId: ResourceId;
  instanceId: string;
  commandId: string;
}

/**
 * Asks the car, through SSM, to pack its matching rosbag folders and upload them to the staging
 * prefix with a one-time presigned URL.
 */
const handler = async ({ jobId }: { jobId: ResourceId }): Promise<JobSendCommandOutput> => {
  const bucket = process.env.DEVICE_LOGS_BUCKET_NAME;
  if (!bucket) {
    throw new Error('DEVICE_LOGS_BUCKET_NAME is not set');
  }

  const job = await carLogFetchJobDao.load({ jobId });
  if (job.source !== 'CAR' || !job.instanceId) {
    throw new CarLogJobError('The job is not a car fetch.');
  }

  const uploadKey = carLogPaths.carUploadKey(jobId);
  const uploadUrl = await s3Helper.getPresignedPutUrl(
    `s3://${bucket}/${uploadKey}`,
    UPLOAD_URL_TTL_SECONDS,
    'application/gzip',
  );

  const commands = buildCarLogUploadScript({
    uploadUrl,
    modelId: job.modelId,
    racerName: job.racerName,
    laterThan: job.laterThan ? new Date(job.laterThan) : undefined,
  });

  const response = await ssmClient.send(
    new SendCommandCommand({
      DocumentName: 'AWS-RunShellScript',
      InstanceIds: [job.instanceId],
      TimeoutSeconds: COMMAND_TIMEOUT_SECONDS,
      Parameters: { commands },
    }),
  );
  const commandId = response.Command?.CommandId;
  if (!commandId) {
    throw new Error('SSM SendCommand did not return a CommandId');
  }

  await carLogFetchJobDao.updateStatus({
    jobId,
    status: CarLogFetchStatus.REQUESTED_UPLOAD,
    attributes: { ssmCommandId: commandId, uploadKey },
  });
  logger.info('Car log upload requested', { jobId, instanceId: job.instanceId, commandId });

  return { jobId, instanceId: job.instanceId, commandId };
};

export const lambdaHandler = instrumentHandler(handler);
