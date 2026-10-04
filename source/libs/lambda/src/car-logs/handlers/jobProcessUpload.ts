// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { HeadObjectCommand } from '@aws-sdk/client-s3';
import {
  carLogAssetDao,
  carLogAssetId,
  carLogFetchJobDao,
  carLogPaths,
  deploymentDao,
  lapDao,
  leaderboardDao,
  modelDao,
  profileDao,
  type ResourceId,
} from '@deepracer-indy/database';
import { CarLogAssetType, CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';

import { s3Client } from '../../utils/clients/s3Client.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { CarLogJobConfig, CarLogJobConfigBag } from '../types.js';
import { parseBagDirName } from '../utils/bagMatcher.js';
import { type BagResolution, extractBags } from '../utils/extractBags.js';
import { CarLogJobError } from '../utils/jobErrors.js';

/** Largest archive accepted; the car-side script and the manual upload both end up here. */
export const MAX_ARCHIVE_BYTES = 20 * 1024 ** 3;

/** Model archive the video processor runs the visualisation against. */
const MODEL_ARCHIVE_NAME = 'pb-only-model.tar.gz';

interface BagContext {
  bag: CarLogJobConfigBag;
}

const assetTypeOf = (relativePath: string): CarLogAssetType | undefined => {
  if (relativePath.endsWith('.db3')) {
    return CarLogAssetType.BAG_SQLITE;
  }
  if (relativePath.endsWith('.mcap')) {
    return CarLogAssetType.BAG_MCAP;
  }
  return undefined;
};

/**
 * Unpacks the archive a car (or a person) uploaded, keeping only the rosbags that belong to a
 * known model, stores them under the owning racer's prefix, registers them as assets and writes
 * the config for the video processor.
 */
const handler = async ({ jobId }: { jobId: ResourceId }): Promise<{ jobId: ResourceId; bagCount: number }> => {
  const bucket = process.env.DEVICE_LOGS_BUCKET_NAME;
  const modelBucket = process.env.MODEL_DATA_BUCKET_NAME;
  if (!bucket || !modelBucket) {
    throw new Error('DEVICE_LOGS_BUCKET_NAME and MODEL_DATA_BUCKET_NAME must be set');
  }

  const job = await carLogFetchJobDao.load({ jobId });
  const uploadKey = job.uploadKey;
  if (!uploadKey || carLogPaths.jobIdFromUploadKey(uploadKey) !== jobId) {
    throw new CarLogJobError('No uploaded archive was found for this job.');
  }

  const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: uploadKey })).catch(() => undefined);
  if (!head) {
    throw new CarLogJobError('No uploaded archive was found for this job.');
  }
  if ((head.ContentLength ?? 0) > MAX_ARCHIVE_BYTES) {
    throw new CarLogJobError('The uploaded archive is too large.');
  }

  const modelCache = new Map<string, Awaited<ReturnType<typeof deploymentDao.listAllByModel>>>();

  const aliases = new Map<string, string | undefined>();
  const aliasOf = async (profileId: ResourceId) => {
    if (!aliases.has(profileId)) {
      aliases.set(profileId, (await profileDao.get({ profileId }))?.alias);
    }
    return aliases.get(profileId);
  };

  const resolve = async (bagDir: string): Promise<BagResolution<BagContext>> => {
    const parsed = parseBagDirName(bagDir);
    if (!parsed) {
      return { accept: false, reason: 'The folder name does not contain a model id.' };
    }
    const { modelId } = parsed;
    if (job.modelId && job.modelId !== modelId) {
      return { accept: false, reason: 'The log belongs to another model than the one requested.' };
    }

    let deployments = modelCache.get(modelId);
    if (!deployments) {
      deployments = await deploymentDao.listAllByModel({ modelId: modelId as ResourceId });
      modelCache.set(modelId, deployments);
    }
    // All deployments of a model belong to the model's owner, even when the model was deleted since.
    const owner = deployments[0];
    if (!owner) {
      return { accept: false, reason: 'The model is not known.' };
    }
    if (job.restrictToProfileId && job.restrictToProfileId !== owner.profileId) {
      return { accept: false, reason: 'The log belongs to a model owned by someone else.' };
    }

    const model = await modelDao.get({ profileId: owner.profileId, modelId: modelId as ResourceId });
    const optimizedPrefix = model?.optimizedArtifactsS3Prefix;
    return {
      accept: true,
      context: {
        bag: {
          bagDir,
          bagPrefix: carLogPaths.bagPrefix(owner.profileId, bagDir),
          profileId: owner.profileId,
          racerName: await aliasOf(owner.profileId),
          modelId,
          modelName: owner.modelName ?? model?.name,
          assetType: CarLogAssetType.BAG_SQLITE,
          modelArtifactKey: optimizedPrefix ? `${optimizedPrefix}${MODEL_ARCHIVE_NAME}` : undefined,
          videoKey: carLogPaths.videoKey(owner.profileId, `${bagDir}.mp4`),
        },
      },
    };
  };

  const assetTypes = new Map<string, CarLogAssetType>();
  const source = await s3Helper.getReadableObjectFromS3(`s3://${bucket}/${uploadKey}`);
  const { accepted, skipped } = await extractBags<BagContext>(source, {
    resolve,
    write: async (context, bagDir, relativePath, body) => {
      const assetType = assetTypeOf(relativePath);
      if (assetType && !assetTypes.has(bagDir)) {
        assetTypes.set(bagDir, assetType);
      }
      await s3Helper.writeToS3(body, `s3://${bucket}/${context.bag.bagPrefix}${relativePath}`);
    },
  });
  for (const { bagDir, reason } of skipped) {
    logger.info('Skipped bag', { jobId, bagDir, reason });
  }

  const bags: CarLogJobConfigBag[] = [];
  for (const { bagDir, context } of accepted) {
    const assetType = assetTypes.get(bagDir);
    if (!assetType) {
      logger.warn('Bag has no recording file', { jobId, bagDir });
      await s3Helper.deleteS3Location(`s3://${bucket}/${context.bag.bagPrefix}`);
      skipped.push({ bagDir, reason: 'The folder contains no recording.' });
      continue;
    }
    bags.push({ ...context.bag, assetType: assetType as CarLogJobConfigBag['assetType'] });
  }
  if (bags.length === 0) {
    throw new CarLogJobError(
      skipped.length > 0
        ? `None of the ${skipped.length} uploaded log folder(s) could be matched to one of your models.`
        : 'The archive contains no log folders.',
    );
  }

  const uploadedAt = new Date().toISOString();
  await Promise.all(
    bags.map((bag) =>
      carLogAssetDao.upsert({
        profileId: bag.profileId as ResourceId,
        assetId: carLogAssetId(bag.bagPrefix),
        assetType: bag.assetType,
        s3Key: bag.bagPrefix,
        filename: bag.bagDir,
        uploadedAt,
        racerName: bag.racerName,
        models: [{ modelId: bag.modelId, modelName: bag.modelName }],
        eventId: job.eventId,
        eventName: job.eventName,
        fetchJobId: jobId,
        carName: job.carName,
      }),
    ),
  );

  const config: CarLogJobConfig = {
    jobId,
    bucket,
    modelBucket,
    carName: job.carName,
    eventName: job.eventName,
    race: await loadRace(job),
    bags,
  };
  await s3Helper.writeToS3(JSON.stringify(config), `s3://${bucket}/${carLogPaths.jobConfigKey(jobId)}`);
  await s3Helper.deleteS3Location(`s3://${bucket}/${uploadKey}`);

  await carLogFetchJobDao.updateStatus({
    jobId,
    status: CarLogFetchStatus.ANALYZED,
    errorMessage:
      skipped.length > 0 ? `${skipped.length} log folder(s) were skipped because they did not match.` : undefined,
  });
  logger.info('Car log upload processed', { jobId, matched: bags.length, skipped: skipped.length });

  return { jobId, bagCount: bags.length };
};

/** Lap results of the run the logs were requested for, so the video can show the lap times. */
async function loadRace(job: Awaited<ReturnType<typeof carLogFetchJobDao.load>>): Promise<CarLogJobConfig['race']> {
  if (!job.runId || !job.leaderboardId) {
    return undefined;
  }
  const [{ data }, leaderboard] = await Promise.all([
    lapDao.listAllLapsByRun({ leaderboardId: job.leaderboardId, runId: job.runId }),
    leaderboardDao.get({ leaderboardId: job.leaderboardId }),
  ]);
  return {
    runId: job.runId,
    racerName: job.racerName,
    trackName: leaderboard?.name,
    laps: data.map(({ lapNumber, lapTimeMs, isValid, resets }) => ({
      lapNumber,
      lapTimeMs,
      isValid,
      resets: resets ?? 0,
    })),
  };
}

export const lambdaHandler = instrumentHandler(handler);
