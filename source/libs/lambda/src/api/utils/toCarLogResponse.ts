// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { CarLogAssetItem, CarLogFetchJobItem } from '@deepracer-indy/database';
import type { CarLogAsset, CarLogFetchJob } from '@deepracer-indy/typescript-server-client';

/** Maps a stored asset to its API shape. The S3 key is internal and never returned. */
export const toCarLogAssetResponse = (item: CarLogAssetItem): CarLogAsset => ({
  assetId: item.assetId,
  profileId: item.profileId,
  racerName: item.racerName,
  type: item.assetType,
  filename: item.filename,
  uploadedAt: new Date(item.uploadedAt),
  models: item.models?.map((m) => ({ modelId: m.modelId, modelName: m.modelName })),
  eventId: item.eventId,
  eventName: item.eventName,
  fetchJobId: item.fetchJobId,
  carName: item.carName,
  mediaMetadata: item.mediaMetadata,
});

/** Maps a stored job to its API shape. Storage locations and execution identifiers are never returned. */
export const toCarLogFetchJobResponse = (item: CarLogFetchJobItem): CarLogFetchJob => ({
  jobId: item.jobId,
  instanceId: item.instanceId,
  carName: item.carName,
  eventId: item.eventId,
  eventName: item.eventName,
  runId: item.runId,
  modelId: item.modelId,
  racerName: item.racerName,
  laterThan: item.laterThan ? new Date(item.laterThan) : undefined,
  status: item.status,
  errorMessage: item.errorMessage,
  createdAt: new Date(item.createdAt),
  endedAt: item.endedAt ? new Date(item.endedAt) : undefined,
});
