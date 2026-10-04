// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import type { Operation } from '@aws-smithy/server-common';
import { carLogFetchJobDao, deviceDao, eventDao, profileDao, runDao, type ResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  CarLogFetchStatus,
  ConflictError,
  getStartCarLogFetchHandler,
  InternalFailureError,
  NotAuthorizedError,
  StartCarLogFetchServerInput,
  StartCarLogFetchServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { sfnClient } from '../../utils/clients/sfnClient.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { requireCarLogEnv } from '../utils/carLogAccess.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** Tolerance for the car clock running ahead of the server when selecting bags newer than a run. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * `POST /car-logs/fetches` — fetch the rosbag logs of a car and turn them into videos
 * (Administrators and Race Facilitators).
 *
 * Returns **202** with the `jobId`; the Step Functions workflow does the rest and progress is
 * delivered through the job status. When a `runId` is given the event, racer and start time are
 * read from the run on the server, so a caller cannot make up race context. Either `modelId` or
 * a racer name must be known, because the on-car bags are selected by them.
 */
export const StartCarLogFetchOperation: Operation<
  StartCarLogFetchServerInput,
  StartCarLogFetchServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can fetch car logs.' });
  }
  const stateMachineArn = requireCarLogEnv('CAR_LOG_STATE_MACHINE_ARN');

  const instanceId = input.instanceId;
  const device = await deviceDao.load({ instanceId });
  if (device.loggingCapable === false) {
    throw new BadRequestError({ message: 'This car does not have the logging feature installed.' });
  }

  const { modelId } = input;
  let { racerName, laterThan } = input;
  let eventId: ResourceId | undefined;
  let eventName: string | undefined;

  if (input.runId) {
    if (!input.leaderboardId) {
      throw new BadRequestError({ message: 'leaderboardId is required together with runId.' });
    }
    const run = await runDao.load({
      leaderboardId: input.leaderboardId as ResourceId,
      runId: input.runId as ResourceId,
    });
    const [racer, event] = await Promise.all([
      profileDao.load({ profileId: run.profileId }),
      eventDao.load({ eventId: run.eventId }),
    ]);
    racerName = racer.alias;
    eventId = event.eventId;
    eventName = event.name;
    laterThan = new Date(new Date(run.createdAt).getTime() - CLOCK_SKEW_MS);
  }

  if (!modelId && !racerName) {
    throw new BadRequestError({ message: 'Specify a run, a model or a racer name to select the logs.' });
  }

  const activeJobs = await carLogFetchJobDao.listActiveByInstance({ instanceId });
  if (activeJobs.length > 0) {
    throw new ConflictError({ message: 'A log fetch is already in progress for this car.' });
  }

  const job = await carLogFetchJobDao.createJob({
    source: 'CAR',
    status: CarLogFetchStatus.CREATED,
    instanceId,
    carName: device.name,
    eventId,
    eventName,
    runId: input.runId as ResourceId | undefined,
    leaderboardId: input.leaderboardId as ResourceId | undefined,
    modelId: modelId as ResourceId | undefined,
    racerName,
    laterThan: laterThan?.toISOString(),
    profileId,
  });

  try {
    await sfnClient.send(
      new StartExecutionCommand({ stateMachineArn, name: job.jobId, input: JSON.stringify({ jobId: job.jobId }) }),
    );
  } catch (error) {
    logger.error('Failed to start car log workflow', { action: 'CAR_LOG_FETCH_FAILURE', jobId: job.jobId, error });
    await carLogFetchJobDao
      .updateStatus({
        jobId: job.jobId,
        status: CarLogFetchStatus.FAILED,
        errorMessage: 'Could not start the workflow.',
      })
      .catch((updateError) => logger.error('Failed to mark job as failed', { jobId: job.jobId, updateError }));
    throw new InternalFailureError({ message: 'Failed to start the log fetch.' });
  }

  logger.info('Car log fetch started', { action: 'CAR_LOG_FETCH', jobId: job.jobId, instanceId });
  return { jobId: job.jobId } satisfies StartCarLogFetchServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getStartCarLogFetchHandler(instrumentOperation(StartCarLogFetchOperation)),
);
