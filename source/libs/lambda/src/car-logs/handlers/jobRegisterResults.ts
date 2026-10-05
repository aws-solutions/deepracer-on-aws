// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  carLogAssetDao,
  carLogAssetId,
  carLogFetchJobDao,
  carLogPaths,
  type ResourceId,
} from '@deepracer-indy/database';
import { CarLogAssetType, CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { CarLogJobConfig, CarLogJobConfigBag } from '../types.js';
import { CarLogJobError } from '../utils/jobErrors.js';
import { parseResultManifest } from '../utils/resultManifest.js';

/**
 * Last step: turns the video processor's result manifest into VIDEO assets and finishes the job.
 * Nothing in the manifest is trusted for ownership: the owner and the allowed location of each
 * video come from the job config this workflow wrote, keyed by the bag directory.
 */
const handler = async ({ jobId }: { jobId: ResourceId }): Promise<{ jobId: ResourceId; videoCount: number }> => {
  const bucket = process.env.DEVICE_LOGS_BUCKET_NAME;
  if (!bucket) {
    throw new Error('DEVICE_LOGS_BUCKET_NAME is not set');
  }

  const [job, configRaw, resultRaw] = await Promise.all([
    carLogFetchJobDao.load({ jobId }),
    s3Helper.getObjectAsStringFromS3(`s3://${bucket}/${carLogPaths.jobConfigKey(jobId)}`),
    s3Helper.getObjectAsStringFromS3(`s3://${bucket}/${carLogPaths.resultKey(jobId)}`, false),
  ]);
  if (!resultRaw) {
    throw new CarLogJobError('The video processor did not produce a result.');
  }

  const config = JSON.parse(configRaw) as CarLogJobConfig;
  const manifest = parseResultManifest(resultRaw);
  if (manifest.jobId !== jobId) {
    throw new CarLogJobError('The video processor returned the result of another job.');
  }
  const bagsByDir = new Map(config.bags.map((bag) => [bag.bagDir, bag]));

  const uploadedAt = new Date().toISOString();
  let registered = 0;
  const covered = new Set<string>();
  for (const video of manifest.videos) {
    const bags = video.bagDirs.map((bagDir) => bagsByDir.get(bagDir));
    const known = bags.filter((bag): bag is CarLogJobConfigBag => bag !== undefined);
    const [first] = known;
    // The processor writes where the config allows: a video belongs to one owner and goes to the
    // location reserved for one of its bags. Anything else is ignored.
    const valid =
      first &&
      known.length === bags.length &&
      known.every((bag) => bag.profileId === first.profileId) &&
      known.some((bag) => bag.videoKey === video.videoKey) &&
      video.videoKey.startsWith(carLogPaths.videoKey(first.profileId, ''));
    if (!valid) {
      logger.warn('Ignoring unexpected video in result', { jobId, bagDirs: video.bagDirs });
      continue;
    }
    const models = [
      ...new Map(known.map((bag) => [bag.modelId, { modelId: bag.modelId, modelName: bag.modelName }])).values(),
    ];
    await carLogAssetDao.upsert({
      profileId: first.profileId as ResourceId,
      assetId: carLogAssetId(video.videoKey),
      assetType: CarLogAssetType.VIDEO,
      s3Key: video.videoKey,
      filename: video.videoKey.slice(video.videoKey.lastIndexOf('/') + 1),
      uploadedAt,
      racerName: first.racerName,
      models,
      eventId: job.eventId,
      eventName: job.eventName,
      fetchJobId: jobId,
      carName: job.carName,
      mediaMetadata: {
        durationSeconds: video.durationSeconds,
        fps: video.fps,
        codec: video.codec,
        resolution: video.resolution,
      },
    });
    known.forEach((bag) => covered.add(bag.bagDir));
    registered += 1;
  }

  if (registered === 0) {
    throw new CarLogJobError('No video could be created from the uploaded logs.');
  }

  const incomplete = config.bags.length - covered.size;
  await carLogFetchJobDao.updateStatus({
    jobId,
    status: CarLogFetchStatus.DONE,
    errorMessage:
      incomplete > 0 ? `${incomplete} of ${config.bags.length} log(s) could not be turned into a video.` : undefined,
  });
  return { jobId, videoCount: registered };
};

export const lambdaHandler = instrumentHandler(handler);
