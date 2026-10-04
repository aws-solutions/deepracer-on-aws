// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { CarLogAssetEntity } from '../entities/CarLogAssetEntity.js';
import type { ResourceId } from '../types/resource.js';

/** Asset rows expire together with the bucket's object lifecycle. */
export const CAR_LOG_ASSET_RETENTION_DAYS = 90;

/**
 * Data access for {@link CarLogAssetEntity}.
 */
export class CarLogAssetDao extends BaseDao<CarLogAssetEntity> {
  /** Creates or replaces an asset; idempotent because the asset id derives from the S3 key. */
  @logMethod
  async upsert(item: Omit<Parameters<CarLogAssetEntity['create']>[0], 'ttl'>) {
    const ttl = Math.floor(Date.now() / 1000) + CAR_LOG_ASSET_RETENTION_DAYS * 24 * 60 * 60;
    const response = await this.entity.put({ ...item, ttl } as Parameters<CarLogAssetEntity['create']>[0]).go();
    return response.data;
  }

  /** Lists one racer's assets. */
  @logMethod
  listByProfile({
    profileId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    profileId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    return this.entity.query.byProfileId({ profileId }).go({ cursor, limit: maxResults });
  }

  /** Lists every racer's assets, newest first. */
  @logMethod
  listAll({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: { cursor?: string | null; maxResults?: number } = {}) {
    return this.entity.query.byUploadedAt({}).go({ cursor, limit: maxResults, order: 'desc' });
  }
}

export const carLogAssetDao = new CarLogAssetDao(CarLogAssetEntity);
