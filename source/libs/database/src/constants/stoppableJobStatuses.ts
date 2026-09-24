// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus } from '@deepracer-indy/typescript-server-client';

/**
 * A list of workflow job statuses that are possible when a model is in a stoppable state.
 *
 * Applies to Training and Evaluation jobs.
 *
 * `WAITING_FOR_CAPACITY` is included so a training job that never reached the queue can still be
 * canceled by the user.
 */
export const STOPPABLE_JOB_STATUSES: JobStatus[] = [
  JobStatus.IN_PROGRESS,
  JobStatus.INITIALIZING,
  JobStatus.QUEUED,
  JobStatus.WAITING_FOR_CAPACITY,
];
