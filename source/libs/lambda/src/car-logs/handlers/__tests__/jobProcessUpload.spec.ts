// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';

import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  carLogAssetDao,
  carLogFetchJobDao,
  deploymentDao,
  lapDao,
  leaderboardDao,
  modelDao,
  profileDao,
} from '@deepracer-indy/database';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';
import { pack as tarPack } from 'tar-stream';

import type { CarLogJobConfig } from '../../types.js';
import { CarLogJobError } from '../../utils/jobErrors.js';
import { lambdaHandler } from '../jobProcessUpload.js';

const s3Mock = mockClient(S3Client);
const JOB_ID = 'abcdefghij12345';
const UPLOAD_KEY = `staging/manual/${JOB_ID}.tar.gz`;
const MODEL_A = 'AAAAAAAAAAAAAAA';
const MODEL_B = 'BBBBBBBBBBBBBBB';
const BAG_A = `racer_modelA_${MODEL_A}-20250101-101010`;
const BAG_B = `other_modelB_${MODEL_B}-20250101-101010`;

async function archive(entries: { name: string; content?: string; type?: 'file' | 'symlink'; linkname?: string }[]) {
  const pack = tarPack();
  for (const e of entries) {
    pack.entry(
      { name: e.name, type: e.type ?? 'file', linkname: e.linkname },
      e.type === 'symlink' ? undefined : (e.content ?? 'x'),
    );
  }
  pack.finalize();
  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(chunk as Buffer);
  }
  return Readable.from([gzipSync(Buffer.concat(chunks))]);
}

const run = (input: unknown) =>
  (lambdaHandler as (i: unknown, c: unknown, cb: unknown) => Promise<unknown>)(input, {}, vi.fn());

describe('jobProcessUpload', () => {
  const writes: Record<string, string> = {};

  const setup = async (entries: Parameters<typeof archive>[0], job: Record<string, unknown> = {}) => {
    vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue({
      jobId: JOB_ID,
      source: 'UPLOAD',
      uploadKey: UPLOAD_KEY,
      profileId: 'uploader',
      ...job,
    } as never);
    vi.spyOn(s3Helper, 'getReadableObjectFromS3').mockResolvedValue(await archive(entries));
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    s3Mock.reset();
    Object.keys(writes).forEach((key) => delete writes[key]);
    vi.stubEnv('DEVICE_LOGS_BUCKET_NAME', 'logs');
    vi.stubEnv('MODEL_DATA_BUCKET_NAME', 'models');
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 1000 });
    vi.spyOn(s3Helper, 'writeToS3').mockImplementation((async (content: unknown, location: unknown) => {
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else {
        for await (const chunk of content as Readable) {
          text += chunk.toString();
        }
      }
      writes[String(location)] = text;
    }) as never);
    vi.spyOn(s3Helper, 'deleteS3Location').mockResolvedValue(undefined as never);
    vi.spyOn(carLogFetchJobDao, 'updateStatus').mockResolvedValue({} as never);
    vi.spyOn(carLogAssetDao, 'upsert').mockResolvedValue({} as never);
    vi.spyOn(deploymentDao, 'listAllByModel').mockImplementation((async ({ modelId }: { modelId: string }) =>
      modelId === MODEL_A
        ? [{ profileId: 'racer1', modelName: 'modelA' }]
        : modelId === MODEL_B
          ? [{ profileId: 'racer2', modelName: 'modelB' }]
          : []) as never);
    vi.spyOn(modelDao, 'get').mockResolvedValue({ optimizedArtifactsS3Prefix: 'models/p/m/optimized/' } as never);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [] } as never);
    vi.spyOn(profileDao, 'get').mockImplementation((async ({ profileId }: { profileId: string }) => ({
      alias: `alias-${profileId}`,
    })) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stores matched bags under the owner, registers assets and writes the job config', async () => {
    await setup([
      { name: `${BAG_A}/metadata.yaml` },
      { name: `${BAG_A}/${BAG_A}_0.db3`, content: 'data' },
      { name: 'unknown_model_ZZZZZZZZZZZZZZZ-20250101-101010/a.db3' },
      { name: 'not-a-bag/a' },
    ]);

    const out = await run({ jobId: JOB_ID });

    expect(out).toEqual({ jobId: JOB_ID, bagCount: 1 });
    expect(writes[`s3://logs/carlogs/racer1/bags/${BAG_A}/${BAG_A}_0.db3`]).toBe('data');
    expect(Object.keys(writes).filter((k) => k.includes('unknown_model'))).toEqual([]);
    expect(carLogAssetDao.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'racer1',
        assetType: 'BAG_SQLITE',
        s3Key: `carlogs/racer1/bags/${BAG_A}/`,
        models: [{ modelId: MODEL_A, modelName: 'modelA' }],
        fetchJobId: JOB_ID,
      }),
    );
    const config = JSON.parse(writes[`s3://logs/job-configs/${JOB_ID}.json`]) as CarLogJobConfig;
    expect(config.bags).toEqual([
      expect.objectContaining({
        bagDir: BAG_A,
        profileId: 'racer1',
        racerName: 'alias-racer1',
        modelArtifactKey: 'models/p/m/optimized/pb-only-model.tar.gz',
        videoKey: `carlogs/racer1/videos/${BAG_A}.mp4`,
      }),
    ]);
    expect(s3Helper.deleteS3Location).toHaveBeenCalledWith(`s3://logs/${UPLOAD_KEY}`);
    expect(carLogFetchJobDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: CarLogFetchStatus.ANALYZED }),
    );
  });

  it('detects mcap bags', async () => {
    await setup([{ name: `${BAG_A}/${BAG_A}_0.mcap` }]);

    await run({ jobId: JOB_ID });

    expect(carLogAssetDao.upsert).toHaveBeenCalledWith(expect.objectContaining({ assetType: 'BAG_MCAP' }));
  });

  it('keeps racers from adding logs of other racers models', async () => {
    await setup([{ name: `${BAG_A}/a.db3` }, { name: `${BAG_B}/b.db3` }], { restrictToProfileId: 'racer2' });

    await run({ jobId: JOB_ID });

    expect(Object.keys(writes).some((k) => k.includes('racer1'))).toBe(false);
    expect(Object.keys(writes).some((k) => k.includes('racer2'))).toBe(true);
  });

  it('only takes the requested model when the job names one', async () => {
    await setup([{ name: `${BAG_A}/a.db3` }, { name: `${BAG_B}/b.db3` }], { source: 'CAR', modelId: MODEL_B });

    await run({ jobId: JOB_ID });

    expect(Object.keys(writes).some((k) => k.includes('racer1'))).toBe(false);
  });

  it('fails when nothing matches', async () => {
    await setup([{ name: 'not-a-bag/a.db3' }]);

    await expect(run({ jobId: JOB_ID })).rejects.toThrow(CarLogJobError);
    expect(carLogAssetDao.upsert).not.toHaveBeenCalled();
  });

  it('drops bags without a recording', async () => {
    await setup([{ name: `${BAG_A}/metadata.yaml` }]);

    await expect(run({ jobId: JOB_ID })).rejects.toThrow(CarLogJobError);
    expect(s3Helper.deleteS3Location).toHaveBeenCalledWith(`s3://logs/carlogs/racer1/bags/${BAG_A}/`);
  });

  it('aborts on unsafe archive entries', async () => {
    await setup([{ name: `${BAG_A}/link`, type: 'symlink', linkname: '/etc/passwd' }]);

    await expect(run({ jobId: JOB_ID })).rejects.toThrow('unsupported entry');
  });

  it('rejects oversized archives before reading them', async () => {
    await setup([{ name: `${BAG_A}/a.db3` }]);
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 50 * 1024 ** 3 });

    await expect(run({ jobId: JOB_ID })).rejects.toThrow('too large');
    expect(s3Helper.getReadableObjectFromS3).not.toHaveBeenCalled();
  });

  it('rejects jobs without an uploaded archive', async () => {
    await setup([], { uploadKey: undefined });

    await expect(run({ jobId: JOB_ID })).rejects.toThrow('No uploaded archive');
  });

  it('includes lap data of the run in the config', async () => {
    await setup([{ name: `${BAG_A}/a.db3` }], {
      source: 'CAR',
      runId: 'run1',
      leaderboardId: 'lb1',
      racerName: 'racer',
    });
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
      data: [{ lapNumber: 1, lapTimeMs: 9000, isValid: true, resets: 2 }],
    } as never);
    vi.spyOn(leaderboardDao, 'get').mockResolvedValue({ name: 'Track A' } as never);

    await run({ jobId: JOB_ID });

    const config = JSON.parse(writes[`s3://logs/job-configs/${JOB_ID}.json`]) as CarLogJobConfig;
    expect(config.race).toEqual({
      runId: 'run1',
      racerName: 'racer',
      trackName: 'Track A',
      laps: [{ lapNumber: 1, lapTimeMs: 9000, isValid: true, resets: 2 }],
    });
  });
});
