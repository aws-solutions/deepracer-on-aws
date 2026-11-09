// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType } from '@deepracer-indy/typescript-server-client';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import type { ResourceId } from '../../types/resource.js';
import { carLogAssetId } from '../../utils/carLogPaths.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { carLogAssetDao } from '../CarLogAssetDao.js';

const asset = (profileId: ResourceId, key: string, overrides: Record<string, unknown> = {}) => ({
  profileId,
  assetId: carLogAssetId(key),
  assetType: CarLogAssetType.VIDEO,
  s3Key: key,
  filename: key.slice(key.lastIndexOf('/') + 1),
  uploadedAt: new Date().toISOString(),
  ...overrides,
});

describe('CarLogAssetDao', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    await Promise.all(
      (Items ?? []).map((item) =>
        testDynamoDBDocumentClient.delete({ TableName: TEST_TABLE_NAME, Key: { pk: item.pk, sk: item.sk } }),
      ),
    );
  });

  it('upserts idempotently by s3 key', async () => {
    const profileId = generateResourceId();
    await carLogAssetDao.upsert(asset(profileId, `carlogs/${profileId}/videos/a.mp4`));
    await carLogAssetDao.upsert(asset(profileId, `carlogs/${profileId}/videos/a.mp4`, { racerName: 'renamed' }));

    const { data } = await carLogAssetDao.listByProfile({ profileId });
    expect(data).toHaveLength(1);
    expect(data[0].racerName).toBe('renamed');
    expect(data[0].ttl).toBeGreaterThan(Date.now() / 1000);
  });

  it('lists assets per profile only', async () => {
    const mine = generateResourceId();
    const other = generateResourceId();
    await carLogAssetDao.upsert(asset(mine, `carlogs/${mine}/videos/a.mp4`));
    await carLogAssetDao.upsert(asset(other, `carlogs/${other}/videos/b.mp4`));

    const { data } = await carLogAssetDao.listByProfile({ profileId: mine });
    expect(data.map((a) => a.s3Key)).toEqual([`carlogs/${mine}/videos/a.mp4`]);
  });

  it('lists all assets newest first', async () => {
    const p1 = generateResourceId();
    const p2 = generateResourceId();
    await carLogAssetDao.upsert(asset(p1, `carlogs/${p1}/videos/old.mp4`, { uploadedAt: '2024-01-01T00:00:00.000Z' }));
    await carLogAssetDao.upsert(asset(p2, `carlogs/${p2}/videos/new.mp4`, { uploadedAt: '2025-01-01T00:00:00.000Z' }));

    const { data } = await carLogAssetDao.listAll();
    expect(data.map((a) => a.filename)).toEqual(['new.mp4', 'old.mp4']);
  });

  it('loads and deletes an asset', async () => {
    const profileId = generateResourceId();
    const item = asset(profileId, `carlogs/${profileId}/videos/a.mp4`);
    await carLogAssetDao.upsert(item);

    expect((await carLogAssetDao.load({ profileId, assetId: item.assetId })).filename).toBe('a.mp4');
    await carLogAssetDao.delete({ profileId, assetId: item.assetId });
    await expect(carLogAssetDao.load({ profileId, assetId: item.assetId })).rejects.toThrow();
  });
});
