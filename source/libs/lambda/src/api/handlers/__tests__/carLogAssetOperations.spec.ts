// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { carLogAssetDao, carLogFetchJobDao } from '@deepracer-indy/database';
import {
  CarLogAssetType,
  CarLogFetchStatus,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { s3Archiver } from '../../../utils/S3Archiver.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateCarLogUploadOperation } from '../createCarLogUpload.js';
import { DeleteCarLogAssetOperation } from '../deleteCarLogAsset.js';
import { GetCarLogAssetUrlsOperation } from '../getCarLogAssetUrls.js';
import { GetCarLogFetchOperation } from '../getCarLogFetch.js';
import { ListCarLogAssetsOperation } from '../listCarLogAssets.js';
import { ListCarLogFetchesOperation } from '../listCarLogFetches.js';

const mockAccess = vi.fn();
const mockIsAdminOrFacilitator = vi.fn();
vi.mock('../../utils/carLogAccess.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/carLogAccess.js')>();
  return { ...actual, getCarLogAccess: (...args: unknown[]) => mockAccess(...args) };
});
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsAdminOrFacilitator(...args) };
});
vi.mock('../../../utils/S3Archiver.js', () => ({ s3Archiver: { createS3Archive: vi.fn() } }));

const CALLER = TEST_OPERATION_CONTEXT.profileId;
const OTHER = 'other1234567890';
const ASSET_ID = 'a'.repeat(64);

const asset = (overrides: Record<string, unknown> = {}) => ({
  profileId: CALLER,
  assetId: ASSET_ID,
  assetType: CarLogAssetType.VIDEO,
  s3Key: `carlogs/${CALLER}/videos/run.mp4`,
  filename: 'run.mp4',
  uploadedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('car log asset operations', () => {
  beforeEach(() => {
    process.env.DEVICE_LOGS_BUCKET_NAME = 'logs-bucket';
    mockAccess.mockResolvedValue('racer');
    mockIsAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue('https://signed.example/object');
    vi.spyOn(s3Helper, 'getPresignedPutUrl').mockResolvedValue('https://signed.example/put');
    vi.spyOn(s3Helper, 'deleteS3Location').mockResolvedValue(undefined);
    vi.spyOn(s3Helper, 'listObjects').mockResolvedValue({
      Contents: [{ Key: `carlogs/${CALLER}/bags/bag1/` }, { Key: `carlogs/${CALLER}/bags/bag1/metadata.yaml` }],
    } as never);
  });

  describe('ListCarLogAssets', () => {
    beforeEach(() => {
      vi.spyOn(carLogAssetDao, 'listByProfile').mockResolvedValue({ data: [asset()], cursor: null } as never);
      vi.spyOn(carLogAssetDao, 'listAll').mockResolvedValue({ data: [asset()], cursor: 'next' } as never);
    });

    it('forces racers to their own assets and ignores the profileId parameter', async () => {
      await ListCarLogAssetsOperation({ profileId: OTHER }, TEST_OPERATION_CONTEXT);

      expect(carLogAssetDao.listByProfile).toHaveBeenCalledWith(expect.objectContaining({ profileId: CALLER }));
      expect(carLogAssetDao.listAll).not.toHaveBeenCalled();
    });

    it.each(['manager', 'viewer'])('lets %s list everyone, or one racer on request', async (role) => {
      mockAccess.mockResolvedValue(role);

      const all = await ListCarLogAssetsOperation({}, TEST_OPERATION_CONTEXT);
      expect(carLogAssetDao.listAll).toHaveBeenCalled();
      expect(all.token).toBe('next');

      await ListCarLogAssetsOperation({ profileId: OTHER }, TEST_OPERATION_CONTEXT);
      expect(carLogAssetDao.listByProfile).toHaveBeenCalledWith(expect.objectContaining({ profileId: OTHER }));
    });

    it('filters by type and never returns the storage key', async () => {
      const out = await ListCarLogAssetsOperation({ type: CarLogAssetType.BAG_MCAP }, TEST_OPERATION_CONTEXT);
      expect(out.assets).toEqual([]);

      const videos = await ListCarLogAssetsOperation({ type: CarLogAssetType.VIDEO }, TEST_OPERATION_CONTEXT);
      expect(videos.assets).toHaveLength(1);
      expect(JSON.stringify(videos.assets)).not.toContain('s3Key');
      expect(JSON.stringify(videos.assets)).not.toContain('carlogs/');
    });
  });

  describe('GetCarLogAssetUrls', () => {
    it('returns a URL for the racer’s own video', async () => {
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(asset() as never);

      const out = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: CALLER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );

      expect(out.urls).toEqual([{ assetId: ASSET_ID, url: 'https://signed.example/object', filename: 'run.mp4' }]);
      expect(out.errors).toEqual([]);
      expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(
        `s3://logs-bucket/carlogs/${CALLER}/videos/run.mp4`,
        300,
        'run.mp4',
        'video/mp4',
      );
    });

    it('answers racers asking for others’ assets exactly like a missing asset', async () => {
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(asset({ profileId: OTHER }) as never);

      const out = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: OTHER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );

      expect(out.urls).toEqual([]);
      expect(out.errors).toEqual([{ assetId: ASSET_ID, code: 'NOT_FOUND', message: 'Asset not found.' }]);
    });

    it('lets commentators download their own bags', async () => {
      mockAccess.mockResolvedValue('viewer');
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(
        asset({ assetType: CarLogAssetType.BAG_SQLITE, s3Key: `carlogs/${CALLER}/bags/b/` }) as never,
      );

      const out = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: CALLER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );
      expect(out.urls.length + (out.errors?.length ?? 0)).toBe(1);
      expect(out.errors ?? []).toEqual([]);
    });

    it('lets commentators watch videos but not take bags', async () => {
      mockAccess.mockResolvedValue('viewer');
      vi.spyOn(carLogAssetDao, 'get')
        .mockResolvedValueOnce(asset({ profileId: OTHER, s3Key: `carlogs/${OTHER}/videos/x.mp4` }) as never)
        .mockResolvedValueOnce(
          asset({
            profileId: OTHER,
            assetType: CarLogAssetType.BAG_SQLITE,
            s3Key: `carlogs/${OTHER}/bags/b/`,
          }) as never,
        );

      const video = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: OTHER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );
      expect(video.urls).toHaveLength(1);

      const bag = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: OTHER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );
      expect(bag.urls).toEqual([]);
      expect(bag.errors[0].code).toBe('FORBIDDEN');
    });

    it('archives a bag folder for managers and returns the archive URL', async () => {
      mockAccess.mockResolvedValue('manager');
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(
        asset({
          assetType: CarLogAssetType.BAG_SQLITE,
          s3Key: `carlogs/${CALLER}/bags/bag1/`,
          filename: 'bag1',
        }) as never,
      );

      const out = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: CALLER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );

      expect(s3Archiver.createS3Archive).toHaveBeenCalledWith(
        [{ filename: 'bag1/metadata.yaml', s3Location: `s3://logs-bucket/carlogs/${CALLER}/bags/bag1/metadata.yaml` }],
        `s3://logs-bucket/downloads/${ASSET_ID}/bag1.tar.gz`,
      );
      expect(out.urls[0].filename).toBe('bag1.tar.gz');
    });

    it('leaves objects with dot or encoded segments out of the archive', async () => {
      mockAccess.mockResolvedValue('manager');
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(
        asset({
          assetType: CarLogAssetType.BAG_SQLITE,
          s3Key: `carlogs/${CALLER}/bags/bag1/`,
          filename: 'bag1',
        }) as never,
      );
      vi.spyOn(s3Helper, 'listObjects').mockResolvedValue({
        Contents: [
          { Key: `carlogs/${CALLER}/bags/bag1/a/../../../../${OTHER}/bags/x/f` },
          { Key: `carlogs/${CALLER}/bags/bag1/%2e%2e/f` },
          { Key: `carlogs/${CALLER}/bags/bag1/ok.db3` },
        ],
      } as never);

      await GetCarLogAssetUrlsOperation({ assets: [{ profileId: CALLER, assetId: ASSET_ID }] }, TEST_OPERATION_CONTEXT);

      expect(s3Archiver.createS3Archive).toHaveBeenCalledWith(
        [{ filename: 'bag1/ok.db3', s3Location: `s3://logs-bucket/carlogs/${CALLER}/bags/bag1/ok.db3` }],
        expect.any(String),
      );
    });

    it('refuses keys outside of the owner’s prefix', async () => {
      mockAccess.mockResolvedValue('manager');
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(asset({ s3Key: 'results/secret.json' }) as never);

      const out = await GetCarLogAssetUrlsOperation(
        { assets: [{ profileId: CALLER, assetId: ASSET_ID }] },
        TEST_OPERATION_CONTEXT,
      );

      expect(out.urls).toEqual([]);
      expect(s3Helper.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('keeps going when one asset fails', async () => {
      vi.spyOn(carLogAssetDao, 'get')
        .mockRejectedValueOnce(new Error('ddb down'))
        .mockResolvedValueOnce(asset() as never);

      const out = await GetCarLogAssetUrlsOperation(
        {
          assets: [
            { profileId: CALLER, assetId: 'b'.repeat(64) },
            { profileId: CALLER, assetId: ASSET_ID },
          ],
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(out.urls).toHaveLength(1);
      expect(out.errors).toHaveLength(1);
    });
  });

  describe('DeleteCarLogAsset', () => {
    beforeEach(() => {
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(asset() as never);
      vi.spyOn(carLogAssetDao, 'delete').mockResolvedValue(undefined as never);
    });

    it('deletes the objects and then the row for the owner', async () => {
      await DeleteCarLogAssetOperation({ profileId: CALLER, assetId: ASSET_ID }, TEST_OPERATION_CONTEXT);

      expect(s3Helper.deleteS3Location).toHaveBeenCalledWith(`s3://logs-bucket/carlogs/${CALLER}/videos/run.mp4`);
      expect(carLogAssetDao.delete).toHaveBeenCalledWith({ profileId: CALLER, assetId: ASSET_ID });
    });

    it('rejects racers and commentators deleting others’ assets', async () => {
      await expect(
        DeleteCarLogAssetOperation({ profileId: OTHER, assetId: ASSET_ID }, TEST_OPERATION_CONTEXT),
      ).rejects.toThrow(NotAuthorizedError);

      mockAccess.mockResolvedValue('viewer');
      await expect(
        DeleteCarLogAssetOperation({ profileId: OTHER, assetId: ASSET_ID }, TEST_OPERATION_CONTEXT),
      ).rejects.toThrow(NotAuthorizedError);
      expect(s3Helper.deleteS3Location).not.toHaveBeenCalled();
    });

    it('lets commentators delete their own assets', async () => {
      mockAccess.mockResolvedValue('viewer');
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(asset({ s3Key: `carlogs/${CALLER}/videos/run.mp4` }) as never);
      vi.spyOn(carLogAssetDao, 'delete').mockResolvedValue(undefined as never);

      await DeleteCarLogAssetOperation({ profileId: CALLER, assetId: ASSET_ID }, TEST_OPERATION_CONTEXT);

      expect(carLogAssetDao.delete).toHaveBeenCalledWith({ profileId: CALLER, assetId: ASSET_ID });
    });

    it('lets managers delete any racer’s asset', async () => {
      mockAccess.mockResolvedValue('manager');
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(
        asset({ profileId: OTHER, s3Key: `carlogs/${OTHER}/videos/x.mp4` }) as never,
      );

      await DeleteCarLogAssetOperation({ profileId: OTHER, assetId: ASSET_ID }, TEST_OPERATION_CONTEXT);

      expect(carLogAssetDao.delete).toHaveBeenCalledWith({ profileId: OTHER, assetId: ASSET_ID });
    });

    it('returns 404 for a missing asset', async () => {
      vi.spyOn(carLogAssetDao, 'get').mockResolvedValue(undefined as never);

      await expect(
        DeleteCarLogAssetOperation({ profileId: CALLER, assetId: ASSET_ID }, TEST_OPERATION_CONTEXT),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('CreateCarLogUpload', () => {
    beforeEach(() => {
      vi.spyOn(carLogFetchJobDao, 'createJob').mockResolvedValue({ jobId: 'job123456789012' } as never);
    });

    it('creates an upload job and a PUT URL for the manual staging prefix', async () => {
      const out = await CreateCarLogUploadOperation({}, TEST_OPERATION_CONTEXT);

      expect(carLogFetchJobDao.createJob).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'UPLOAD', status: CarLogFetchStatus.WAITING_FOR_UPLOAD, profileId: CALLER }),
      );
      expect(s3Helper.getPresignedPutUrl).toHaveBeenCalledWith(
        's3://logs-bucket/staging/manual/job123456789012.tar.gz',
        900,
        'application/gzip',
      );
      expect(out.url).toBe('https://signed.example/put');
      expect(out.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('restricts uploads by racers to their own models, but not uploads by managers', async () => {
      mockAccess.mockResolvedValue('racer');
      await CreateCarLogUploadOperation({}, TEST_OPERATION_CONTEXT);
      expect(carLogFetchJobDao.createJob).toHaveBeenLastCalledWith(
        expect.objectContaining({ restrictToProfileId: CALLER }),
      );

      mockAccess.mockResolvedValue('manager');
      await CreateCarLogUploadOperation({}, TEST_OPERATION_CONTEXT);
      expect(carLogFetchJobDao.createJob).toHaveBeenLastCalledWith(
        expect.objectContaining({ restrictToProfileId: undefined }),
      );
    });

    it('rejects commentators', async () => {
      mockAccess.mockResolvedValue('viewer');

      await expect(CreateCarLogUploadOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
    });
  });

  describe('fetch job reads', () => {
    it('are limited to administrators and facilitators', async () => {
      mockIsAdminOrFacilitator.mockResolvedValue(false);

      await expect(ListCarLogFetchesOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
      await expect(GetCarLogFetchOperation({ jobId: 'job123456789012' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
        NotAuthorizedError,
      );
    });

    it('list by event when one is given and map jobs without internals', async () => {
      const job = {
        jobId: 'job123456789012',
        status: CarLogFetchStatus.DONE,
        createdAt: '2025-01-01T00:00:00.000Z',
        executionArn: 'arn:secret',
        uploadKey: 'staging/car/x',
      };
      vi.spyOn(carLogFetchJobDao, 'listByEvent').mockResolvedValue({ data: [job], cursor: null } as never);
      vi.spyOn(carLogFetchJobDao, 'load').mockResolvedValue(job as never);

      const list = await ListCarLogFetchesOperation({ eventId: 'event1234567890' }, TEST_OPERATION_CONTEXT);
      const single = await GetCarLogFetchOperation({ jobId: 'job123456789012' }, TEST_OPERATION_CONTEXT);

      expect(carLogFetchJobDao.listByEvent).toHaveBeenCalled();
      expect(list.jobs[0].jobId).toBe('job123456789012');
      expect(JSON.stringify([list, single])).not.toMatch(/arn:secret|staging\/car/);
    });
  });
});
