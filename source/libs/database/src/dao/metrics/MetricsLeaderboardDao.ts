// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { LeaderboardsEntity } from '../../entities/LeaderboardsEntity.js';
import { decodeCursor, encodeCursor } from '../../utils/cursorUtils.js';
import { LeaderboardDao } from '../LeaderboardDao.js';

/**
 * Metrics-specific DAO for leaderboard operations
 * Extends LeaderboardDao to provide metrics-specific functionality
 */
export class MetricsLeaderboardDao extends LeaderboardDao {
  /**
   * List leaderboard IDs for metrics collection with pagination support
   * @param cursor - Optional cursor for pagination
   * @param maxResults - Maximum number of results to return
   * @returns Promise with leaderboard IDs and cursor for pagination
   */
  @logMethod
  async listIdsForMetrics({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    cursor?: string | null;
    maxResults?: number;
  } = {}) {
    const result = await this.entity.query.sortedByCloseTime({}).go({
      attributes: [DynamoDBItemAttribute.LEADERBOARD_ID],
      limit: maxResults,
      cursor: decodeCursor(cursor),
    });

    return {
      data: result.data.map((leaderboard) => leaderboard.leaderboardId),
      cursor: encodeCursor(result.cursor),
    };
  }

  /**
   * Count the total number of leaderboards
   * @returns Promise<number> The total count of leaderboards
   */
  @logMethod
  async count(): Promise<number> {
    let totalCount = 0;
    let cursor: string | null = null;

    do {
      const result = await this.listIdsForMetrics({ cursor });
      totalCount += result.data.length;
      cursor = result.cursor;
    } while (cursor);

    return totalCount;
  }
}

export const metricsLeaderboardDao = new MetricsLeaderboardDao(LeaderboardsEntity);
