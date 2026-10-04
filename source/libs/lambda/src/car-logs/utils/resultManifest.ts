// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '@deepracer-indy/utils';

import { CarLogJobError } from './jobErrors.js';
import type { CarLogResultManifest, CarLogResultVideo } from '../types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown, max = 100) => (typeof value === 'string' ? value.slice(0, max) : undefined);
const optionalNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/**
 * Parses the manifest written by the video processor. The container runs third-party code on
 * untrusted recordings, so the manifest is validated strictly and only known fields are kept.
 */
export function parseResultManifest(raw: string): CarLogResultManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error('The video processor result is not valid JSON', { error });
    throw new CarLogJobError('The video processor returned an unreadable result.');
  }
  if (!isRecord(parsed) || typeof parsed.jobId !== 'string' || !Array.isArray(parsed.videos)) {
    throw new CarLogJobError('The video processor returned an unexpected result.');
  }

  const videos: CarLogResultVideo[] = [];
  for (const video of parsed.videos) {
    if (
      !isRecord(video) ||
      typeof video.videoKey !== 'string' ||
      !Array.isArray(video.bagDirs) ||
      video.bagDirs.length === 0 ||
      !video.bagDirs.every((bagDir) => typeof bagDir === 'string')
    ) {
      throw new CarLogJobError('The video processor returned an unexpected result.');
    }
    videos.push({
      bagDirs: video.bagDirs as string[],
      videoKey: video.videoKey,
      durationSeconds: optionalNumber(video.durationSeconds),
      fps: optionalNumber(video.fps),
      codec: optionalString(video.codec, 50),
      resolution: optionalString(video.resolution, 20),
    });
  }

  const failures = Array.isArray(parsed.failures)
    ? parsed.failures.flatMap((failure) =>
        isRecord(failure) && typeof failure.bagDir === 'string'
          ? [{ bagDir: failure.bagDir, reason: optionalString(failure.reason, 200) ?? 'Unknown error' }]
          : [],
      )
    : undefined;

  return { jobId: parsed.jobId, videos, failures };
}
