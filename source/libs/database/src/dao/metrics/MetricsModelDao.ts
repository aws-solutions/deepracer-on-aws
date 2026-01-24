// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { metricsProfileDao } from './MetricsProfileDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { ModelsEntity } from '../../entities/ModelsEntity.js';
import type { ResourceId } from '../../types/resource.js';
import { decodeCursor, encodeCursor } from '../../utils/cursorUtils.js';
import { ModelDao } from '../ModelDao.js';

/**
 * Metrics-specific DAO for model operations
 * Extends ModelDao to provide metrics-specific functionality
 */
export class MetricsModelDao extends ModelDao {
  /**
   * List model IDs for a specific profile with pagination support
   * @param profileId - The profile ID to get models for
   * @param cursor - Optional cursor for pagination
   * @param maxResults - Maximum number of results to return
   * @returns Promise with model IDs and cursor for pagination
   */
  @logMethod
  async listModelIds({
    profileId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    profileId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    const result = await this.entity.query.byProfileId({ profileId }).go({
      attributes: [DynamoDBItemAttribute.MODEL_ID],
      limit: maxResults,
      cursor: decodeCursor(cursor),
    });

    return {
      data: result.data.map((model) => model.modelId),
      cursor: encodeCursor(result.cursor),
    };
  }

  /**
   * Count models for a specific profile
   * @param profileId - The profile ID to count models for
   * @returns Promise<number> The count of models for the profile
   */
  @logMethod
  async countByProfile(profileId: ResourceId): Promise<number> {
    let totalCount = 0;
    let cursor: string | null = null;

    do {
      const result = await this.listModelIds({ profileId, cursor });
      totalCount += result.data.length;
      cursor = result.cursor;
    } while (cursor);

    return totalCount;
  }

  /**
   * Count the total number of models across all profiles
   * @returns Promise<number> The total count of all models
   */
  @logMethod
  async count(): Promise<number> {
    let totalCount = 0;
    let profileCursor: string | null = null;

    // Get all profile IDs and count models for each profile
    do {
      const profileResult = await metricsProfileDao.listProfileIds({ cursor: profileCursor });

      // Count models for each profile in this batch
      for (const profileId of profileResult.data) {
        const modelCount = await this.countByProfile(profileId);
        totalCount += modelCount;
      }

      profileCursor = profileResult.cursor;
    } while (profileCursor);

    return totalCount;
  }
}

export const metricsModelDao = new MetricsModelDao(ModelsEntity);
