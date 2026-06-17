// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ResourceId } from '@deepracer-indy/database';

export type LiveRaceContext = {
  leaderboardId: ResourceId;
  modelsProcessed: number;

  /** Current queue item being evaluated */
  currentSubmissionId?: ResourceId;

  /** Reuses existing WorkflowContext fields for JobInitializer/Monitor/Finalizer */
  jobName?: string;
  modelId?: ResourceId;
  profileId?: ResourceId;

  /** Set by GetNextPending */
  queueEmpty?: boolean;

  /** Set by CheckAutolaunch */
  continueLoop?: boolean;
};
