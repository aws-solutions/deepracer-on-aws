// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';

/**
 * Object key layout of the device logs bucket for the car-log feature.
 *
 * - `staging/car/{jobId}.tar.gz`            archive uploaded by a car (short-lived)
 * - `staging/manual/{jobId}.tar.gz`         archive uploaded manually; the only prefix that auto-starts processing
 * - `job-configs/{jobId}.json`              input for the video processor
 * - `results/{jobId}.json`                  manifest written by the video processor
 * - `downloads/{jobId}/{name}`              short-lived zip archives of bags for download
 * - `carlogs/{profileId}/bags/{bagDir}/`    extracted rosbag
 * - `carlogs/{profileId}/videos/{name}`     generated video
 */
export const CAR_LOG_STAGING_CAR_PREFIX = 'staging/car/';
export const CAR_LOG_STAGING_MANUAL_PREFIX = 'staging/manual/';
export const CAR_LOG_ASSETS_PREFIX = 'carlogs/';

export const carLogPaths = {
  carUploadKey: (jobId: string) => `${CAR_LOG_STAGING_CAR_PREFIX}${jobId}.tar.gz`,
  manualUploadKey: (jobId: string) => `${CAR_LOG_STAGING_MANUAL_PREFIX}${jobId}.tar.gz`,
  jobConfigKey: (jobId: string) => `job-configs/${jobId}.json`,
  resultKey: (jobId: string) => `results/${jobId}.json`,
  downloadKey: (jobId: string, name: string) => `downloads/${jobId}/${name}`,
  profilePrefix: (profileId: string) => `${CAR_LOG_ASSETS_PREFIX}${profileId}/`,
  bagPrefix: (profileId: string, bagDir: string) => `${CAR_LOG_ASSETS_PREFIX}${profileId}/bags/${bagDir}/`,
  videoKey: (profileId: string, filename: string) => `${CAR_LOG_ASSETS_PREFIX}${profileId}/videos/${filename}`,

  /** Extracts the job id from a staging key, or undefined if the key is not an upload archive. */
  jobIdFromUploadKey: (key: string) => /^staging\/(?:car|manual)\/([A-Za-z0-9]{15})\.tar\.gz$/.exec(key)?.[1],
} as const;

/** Deterministic asset id: SHA-256 (hex) of the S3 key, so re-processing upserts instead of duplicating. */
export const carLogAssetId = (s3Key: string) => createHash('sha256').update(s3Key).digest('hex');
