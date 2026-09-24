// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeploymentItem } from '@deepracer-indy/database';
import type { DeploymentSummary } from '@deepracer-indy/typescript-server-client';

/** Maps a DeploymentItem entity to the Smithy DeploymentSummary response shape. */
export const toDeploymentSummary = (d: DeploymentItem): DeploymentSummary => ({
  deploymentId: d.deploymentId,
  modelId: d.modelId,
  modelName: d.modelName,
  carInstanceId: d.carInstanceId,
  carName: d.carName,
  batchId: d.batchId,
  status: d.status,
  createdAt: new Date(d.createdAt),
  uploadStartedAt: d.uploadStartedAt ? new Date(d.uploadStartedAt) : undefined,
  completedAt: d.completedAt ? new Date(d.completedAt) : undefined,
  errorMessage: d.errorMessage,
});
