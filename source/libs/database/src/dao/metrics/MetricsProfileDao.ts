// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { ProfilesEntity } from '../../entities/ProfilesEntity.js';
import { decodeCursor, encodeCursor } from '../../utils/cursorUtils.js';
import { ProfileDao } from '../ProfileDao.js';

/**
 * Metrics-specific DAO for profile operations
 * Extends ProfileDao to provide metrics-specific functionality
 */
export class MetricsProfileDao extends ProfileDao {
  /**
   * List profile IDs with pagination support
   * @param cursor - Optional cursor for pagination
   * @param maxResults - Maximum number of results to return
   * @returns Promise with profile IDs and cursor for pagination
   */
  @logMethod
  async listProfileIds({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    cursor?: string | null;
    maxResults?: number;
  } = {}) {
    const result = await this.entity.query.bySortKey({}).go({
      attributes: [DynamoDBItemAttribute.PROFILE_ID],
      limit: maxResults,
      cursor: decodeCursor(cursor),
    });

    return {
      data: result.data.map((profile) => profile.profileId),
      cursor: encodeCursor(result.cursor),
    };
  }

  /**
   * Count the total number of profiles
   * @returns Promise<number> The total count of profiles
   */
  @logMethod
  async count(): Promise<number> {
    let totalCount = 0;
    let cursor: string | null = null;

    do {
      const result = await this.listProfileIds({ cursor });
      totalCount += result.data.length;
      cursor = result.cursor;
    } while (cursor);

    return totalCount;
  }
}

export const metricsProfileDao = new MetricsProfileDao(ProfilesEntity);
