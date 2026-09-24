// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import type { JobName, JobType, ResourceId } from '@deepracer-indy/database';

export type WorkflowContext<JT extends JobType = JobType> = {
  jobName: JobName<JT>;
  modelId: ResourceId;
  profileId: ResourceId;

  simulationJob?: {
    heartbeatS3Location: string;
  };

  /** SageMaker training job */
  trainingJob?: {
    arn: string;
    name: JobName<JT>;
    status?: TrainingJobStatus;
    modelArtifactS3Location?: string;
  };

  /** Kinesis video stream */
  videoStream?: {
    arn: string;
    name: JobName<JT>;
    url?: string;
    urlExpiration?: string;
  };

  /** Workflow error details */
  errorDetails?: Error;

  /**
   * Set by JobInitializer when a SageMaker training quota left no room for this job. The state
   * machine routes this to cleanup and a successful end rather than the failure branch, because the
   * model is still valid and the user can retry it manually.
   */
  capacityWaiting?: boolean;

  /** User-facing explanation persisted alongside a WAITING_FOR_CAPACITY status */
  statusMessage?: string;

  /** Final job status set by JobFinalizer (used by live race SF to route to SetFailed) */
  jobStatus?: string;

  /** Live race model counter (used by live race SF only) */
  modelsProcessed?: number;
} & (JT extends JobType.SUBMISSION
  ? {
      leaderboardId: ResourceId;
    }
  : {
      leaderboardId?: never;
    });
