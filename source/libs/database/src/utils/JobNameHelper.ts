// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { JobType } from '../constants/jobType.js';
import type { JobName } from '../types/jobName.js';
import type { ResourceId } from '../types/resource.js';

export class JobNameHelper {
  getJobId<JT extends JobType>(jobName: JobName<JT>) {
    return jobName.split('-')[2] as ResourceId;
  }

  getJobType<JT extends JobType>(jobName: JobName<JT>) {
    return jobName.split('-')[1] as JT;
  }

  getJobName<JT extends JobType>(jobType: JT, jobId: ResourceId): JobName<JT> {
    const jobNamePrefix = 'deepracerindy' as const; // TODO: link to config?

    return `${jobNamePrefix}-${jobType}-${jobId}`;
  }
}

export const jobNameHelper = new JobNameHelper();
