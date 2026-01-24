// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ResourceId } from './resource.js';
import type { JobType } from '../constants/jobType.js';

/**
 * Workflow job name.
 *
 * The following are set to the workflow job name during workflow initialization:
 * - SageMaker Training Job name
 * - Kinesis Video Stream name
 */
export type JobName<JT extends JobType = JobType> = `deepracerindy-${JT}-${ResourceId}`;

/**
 * Extracts the workflow job type from the job name.
 */
export type ExtractJobType<JN extends JobName> = JN extends JobName<infer JT> ? JT : never;
