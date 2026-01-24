// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobName, ResourceId, JobType, evaluationDao, submissionDao, trainingDao } from '@deepracer-indy/database';

export type UpdateJobFn = {
  [JobType.EVALUATION]: (typeof evaluationDao)['update'];
  [JobType.SUBMISSION]: (typeof submissionDao)['update'];
  [JobType.TRAINING]: (typeof trainingDao)['update'];
};

export type UpdateJobIdentifiers<JT extends JobType> = {
  jobName: JobName<JT>;
} & (JT extends JobType.SUBMISSION
  ? { leaderboardId: ResourceId; modelId?: ResourceId; profileId: ResourceId }
  : { leaderboardId?: ResourceId; modelId: ResourceId; profileId?: ResourceId });

export type UpdatedJobAttributes<JT extends JobType> = Parameters<UpdateJobFn[JT]>[1];
