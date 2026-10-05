// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogFetchJobDao, type ResourceId } from '@deepracer-indy/database';
import type { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/** Moves a job to a new status; the state machine passes `jobId` and the `status` to set. */
const handler = async (input: { jobId: ResourceId; status: CarLogFetchStatus }): Promise<{ jobId: ResourceId }> => {
  await carLogFetchJobDao.updateStatus({ jobId: input.jobId, status: input.status });
  return { jobId: input.jobId };
};

export const lambdaHandler = instrumentHandler(handler);
