// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetCommandInvocationCommand, InvocationDoesNotExist } from '@aws-sdk/client-ssm';
import { carLogFetchJobDao } from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { JobSendCommandOutput } from './jobSendCommand.js';
import { ssmClient } from '../../utils/clients/ssmClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export interface JobPollCommandOutput extends JobSendCommandOutput {
  outcome: 'PENDING' | 'SUCCESS' | 'FAILED';
  pollCount: number;
  /** True once the job was moved to WAITING_FOR_UPLOAD, so that this is written only once. */
  waitingMarked?: boolean;
}

const PENDING_STATUSES = new Set(['Pending', 'InProgress', 'Delayed']);
const ERROR_TAIL_CHARS = 300;

/** Last part of the script's error output; that is where the reason for a failure is. */
const errorTail = (stderr?: string) => {
  const text = stderr?.trim();
  return text ? text.slice(-ERROR_TAIL_CHARS) : undefined;
};

/**
 * Checks on the SSM command that makes the car upload its logs. Called in a wait loop by the
 * state machine until `outcome` is no longer `PENDING`.
 */
const handler = async (
  input: JobSendCommandOutput & { pollCount?: number; waitingMarked?: boolean },
): Promise<JobPollCommandOutput> => {
  const { jobId, commandId, instanceId } = input;
  const pollCount = (input.pollCount ?? 0) + 1;

  let status: string;
  let stderr: string | undefined;
  try {
    const response = await ssmClient.send(
      new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId }),
    );
    status = response.Status ?? 'Unknown';
    stderr = response.StandardErrorContent;
  } catch (error) {
    // The invocation can take a moment to show up after SendCommand.
    if (error instanceof InvocationDoesNotExist) {
      return { ...input, outcome: 'PENDING', pollCount };
    }
    throw error;
  }

  if (PENDING_STATUSES.has(status)) {
    const markWaiting = status === 'InProgress' && !input.waitingMarked;
    if (markWaiting) {
      await carLogFetchJobDao.updateStatus({ jobId, status: CarLogFetchStatus.WAITING_FOR_UPLOAD });
    }
    return { ...input, outcome: 'PENDING', pollCount, waitingMarked: input.waitingMarked || markWaiting };
  }

  if (status === 'Success') {
    await carLogFetchJobDao.updateStatus({ jobId, status: CarLogFetchStatus.UPLOADED });
    return { ...input, outcome: 'SUCCESS', pollCount };
  }

  logger.warn('Car log upload command failed', { jobId, commandId, status });
  const reason = errorTail(stderr);
  await carLogFetchJobDao.updateStatus({
    jobId,
    status: CarLogFetchStatus.UPLOAD_FAILED,
    errorMessage: `The car could not upload its logs (${status})${reason ? `: ${reason}` : ''}`,
  });
  return { ...input, outcome: 'FAILED', pollCount };
};

export const lambdaHandler = instrumentHandler(handler);
