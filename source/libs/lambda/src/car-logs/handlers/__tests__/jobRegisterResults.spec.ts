// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogAssetDao, carLogFetchJobDao } from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import type { CarLogJobConfig } from '../../types.js';
import { lambdaHandler } from '../jobRegisterResults.js';

const JOB_ID = 'abcdefghij12345';
const BAG = 'racer_model_AAAAAAAAAAAAAAA-20250101-101010';
const VIDEO_KEY = `carlogs/racer1/videos/${BAG}.mp4`;

const config: CarLogJobConfig = {
  jobId: JOB_ID,
  bucket: 'logs',
  modelBucket: 'models',
  bags: [
    {
      bagDir: BAG,
      bagPrefix: `carlogs/racer1/bags/${BAG}/`,
      profileId: 'racer1',
      modelId: 'AAAAAAAAAAAAAAA',
      modelName: 'model',
      assetType: 'BAG_SQLITE',
      videoKey: VIDEO_KEY,
    },
  ],
};

const run = (input: unknown) =>
  (lambdaHandler as (i: unknown, c: unknown, cb: unknown) => Promise<unknown>)(input, {}, vi.fn());

const withResult = (result: unknown) =>
  vi
    .spyOn(s3Helper, 'getObjectAsStringFromS3')
    .mockImplementation((async (location: unknown) =>
      String(location).includes('job-configs')
        ? JSON.stringify(config)
        : result === undefined
          ? ''
          : JSON.stringify(result)) as never);

describe('jobRegisterResults', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('DEVICE_LOGS_BUCKET_NAME', 'logs');
    vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
      jobId: JOB_ID,
      eventId: 'e1',
      eventName: 'Event',
    } as never);
    vi.spyOn(carLogFetchJobDao, 'updateStatus').mockResolvedValue({} as never);
    vi.spyOn(carLogAssetDao, 'upsert').mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers videos and completes the job', async () => {
    withResult({
      jobId: JOB_ID,
      videos: [
        { bagDirs: [BAG], videoKey: VIDEO_KEY, durationSeconds: 61, fps: 15, codec: 'h264', resolution: '640x480' },
      ],
    });

    await expect(run({ jobId: JOB_ID })).resolves.toEqual({ jobId: JOB_ID, videoCount: 1 });

    expect(carLogAssetDao.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'racer1',
        assetType: 'VIDEO',
        s3Key: VIDEO_KEY,
        filename: `${BAG}.mp4`,
        eventId: 'e1',
        mediaMetadata: { durationSeconds: 61, fps: 15, codec: 'h264', resolution: '640x480' },
      }),
    );
    expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: CarLogFetchStatus.DONE, errorMessage: undefined }),
    );
  });

  it('ignores videos that are not where the job config put them', async () => {
    withResult({
      jobId: JOB_ID,
      videos: [
        { bagDirs: [BAG], videoKey: 'carlogs/victim/videos/x.mp4' },
        { bagDirs: ['unknown'], videoKey: VIDEO_KEY },
      ],
    });

    await expect(run({ jobId: JOB_ID })).rejects.toThrow('No video could be created');
    expect(carLogAssetDao.upsert).not.toHaveBeenCalled();
  });

  it('registers one video for several bags of the same owner', async () => {
    config.bags.push({
      ...config.bags[0],
      bagDir: 'second',
      modelId: 'BBBBBBBBBBBBBBB',
      modelName: 'other',
      videoKey: 'carlogs/racer1/videos/second.mp4',
    });
    withResult({ jobId: JOB_ID, videos: [{ bagDirs: [BAG, 'second'], videoKey: VIDEO_KEY }] });

    await expect(run({ jobId: JOB_ID })).resolves.toEqual({ jobId: JOB_ID, videoCount: 1 });
    config.bags.pop();

    expect(carLogAssetDao.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [
          { modelId: 'AAAAAAAAAAAAAAA', modelName: 'model' },
          { modelId: 'BBBBBBBBBBBBBBB', modelName: 'other' },
        ],
      }),
    );
    expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: CarLogFetchStatus.DONE, errorMessage: undefined }),
    );
  });

  it('ignores videos mixing bags of different owners', async () => {
    config.bags.push({ ...config.bags[0], bagDir: 'second', profileId: 'racer2' });
    withResult({ jobId: JOB_ID, videos: [{ bagDirs: [BAG, 'second'], videoKey: VIDEO_KEY }] });

    await expect(run({ jobId: JOB_ID })).rejects.toThrow('No video could be created');
    config.bags.pop();
  });

  it('reports partial results', async () => {
    config.bags.push({ ...config.bags[0], bagDir: 'second', videoKey: 'carlogs/racer1/videos/second.mp4' });
    withResult({ jobId: JOB_ID, videos: [{ bagDirs: [BAG], videoKey: VIDEO_KEY }] });

    await run({ jobId: JOB_ID });
    config.bags.pop();

    expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CarLogFetchStatus.DONE,
        errorMessage: '1 of 2 log(s) could not be turned into a video.',
      }),
    );
  });

  it('fails when the result is missing, malformed or for another job', async () => {
    withResult(undefined);
    await expect(run({ jobId: JOB_ID })).rejects.toThrow('did not produce a result');

    withResult({ jobId: JOB_ID, videos: 'nope' });
    await expect(run({ jobId: JOB_ID })).rejects.toThrow('unexpected result');

    withResult({ jobId: 'otherjob1234567', videos: [] });
    await expect(run({ jobId: JOB_ID })).rejects.toThrow('another job');
  });
});
