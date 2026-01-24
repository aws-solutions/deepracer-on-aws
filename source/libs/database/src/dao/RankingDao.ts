// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger, logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { ELECTRO_DB_MAX_CONCURRENCY } from '../constants/electroDB.js';
import { RankingsEntity } from '../entities/RankingsEntity.js';
import type { ResourceId } from '../types/resource.js';
import { electroDBEventLogger } from '../utils/electroDBEventLogger.js';

export class RankingDao extends BaseDao<RankingsEntity> {
  @logMethod
  listByRank({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    leaderboardId,
  }: {
    cursor?: string | null;
    maxResults?: number;
    leaderboardId: ResourceId;
  }) {
    return this.entity.query.sortedByRank({ leaderboardId }).go({ cursor, limit: maxResults, order: 'asc' });
  }

  @logMethod
  async getWithRank({ leaderboardId, profileId }: { leaderboardId: ResourceId; profileId: ResourceId }) {
    const rankingItem = await this._get({ leaderboardId, profileId });

    if (!rankingItem) {
      return null;
    }

    const { data: rankings } = await this.entity.query
      .sortedByRank({ leaderboardId })
      .lt({ rankingScore: rankingItem.rankingScore })
      .go({ order: 'asc', pages: 'all' });

    return {
      ...rankingItem,
      rank: rankings.length + 1,
    };
  }

  @logMethod
  async deleteByLeaderboardId(leaderboardId: ResourceId) {
    logger.info(`Deleting all rankings for leaderboardId: ${leaderboardId}`);

    const { data: rankings } = await this.entity.query.byLeaderboardId({ leaderboardId }).go({ pages: 'all' });

    const { unprocessed: unprocessedItems } = await this.entity
      .delete(rankings)
      .go({ concurrency: ELECTRO_DB_MAX_CONCURRENCY, logger: electroDBEventLogger });

    logger.info(
      `Deleted ${rankings.length - unprocessedItems.length} rankings with ${unprocessedItems.length} unprocessed.`,
      {
        leaderboardId,
        unprocessedItems,
      },
    );
  }
}

export const rankingDao = new RankingDao(RankingsEntity);
