// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType, CarLogFetchStatus } from '@deepracer-indy/typescript-client';
import humanizeDuration from 'humanize-duration';

export const CAR_LOG_FETCH_ACTIVE_STATUSES = new Set<CarLogFetchStatus>([
  CarLogFetchStatus.CREATED,
  CarLogFetchStatus.REQUESTED_UPLOAD,
  CarLogFetchStatus.WAITING_FOR_UPLOAD,
  CarLogFetchStatus.UPLOADED,
  CarLogFetchStatus.ANALYZED,
  CarLogFetchStatus.QUEUED_FOR_PROCESSING,
  CarLogFetchStatus.PROCESSING,
]);

export const isCarLogFetchActive = (status: CarLogFetchStatus): boolean => CAR_LOG_FETCH_ACTIVE_STATUSES.has(status);

export const formatCarLogDateTime = (date?: Date): string => (date ? new Date(date).toLocaleString() : '—');

export const formatCarLogDuration = (durationSeconds?: number): string => {
  if (durationSeconds === undefined) return '—';
  return humanizeDuration(durationSeconds * 1000, { round: true, units: ['h', 'm', 's'], largest: 2 });
};

export const formatCarLogModels = (models?: { modelName?: string; modelId: string }[]): string => {
  if (!models?.length) return '—';
  return models.map((model) => model.modelName ?? model.modelId).join(', ');
};

export const formatCarLogAssetType = (type: CarLogAssetType): string => {
  switch (type) {
    case CarLogAssetType.VIDEO:
      return 'VIDEO';
    case CarLogAssetType.BAG_MCAP:
      return 'BAG_MCAP';
    case CarLogAssetType.BAG_SQLITE:
      return 'BAG_SQLITE';
    default:
      return type;
  }
};

export const downloadPresignedAsset = async (url: string, filename: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }
};
