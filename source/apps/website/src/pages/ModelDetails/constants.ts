// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeploymentStatus, JobStatus, OptimizationStatus } from '@deepracer-indy/typescript-client';

export const POLLING_INTERVAL_TIME = 10_000; // 10 seconds

export const LIST_MODELS_POLLING_INTERVAL_TIME = 30_000; // 30 seconds

export const OPTIMIZATION_POLLING_INTERVAL_TIME = 3_000; // 3 seconds
export const DEPLOYMENT_POLLING_INTERVAL_TIME = 3_000; // 3 seconds

export const MAX_BATCH_OPTIMIZE = 50; // Maximum models to optimize in a single batch action

export const OPTIMIZE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes — fallback if optimizer Lambda silently fails

export const TERMINAL_EVALUATION_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.CANCELED, JobStatus.FAILED];

export const TERMINAL_OPTIMIZATION_STATUSES: OptimizationStatus[] = [
  OptimizationStatus.OPTIMIZED,
  OptimizationStatus.FAILED,
];

export const TERMINAL_DEPLOYMENT_STATUSES: DeploymentStatus[] = [DeploymentStatus.COMPLETED, DeploymentStatus.FAILED];
