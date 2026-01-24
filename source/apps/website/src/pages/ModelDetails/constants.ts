// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus } from '@deepracer-indy/typescript-client';

export const POLLING_INTERVAL_TIME = 10_000; // 10 seconds

export const LIST_MODELS_POLLING_INTERVAL_TIME = 30_000; // 30 seconds

export const TERMINAL_EVALUATION_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.CANCELED, JobStatus.FAILED];
