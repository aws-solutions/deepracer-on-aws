// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { LeaderboardsEntity } from '../entities/LeaderboardsEntity.js';

export class LeaderboardDao extends BaseDao<LeaderboardsEntity> {
  @logMethod
  list({ cursor = null, maxResults = DEFAULT_MAX_QUERY_RESULTS }: { cursor?: string | null; maxResults?: number }) {
    return this.entity.query.sortedByCloseTime({}).go({ cursor, limit: maxResults });
  }

  @logMethod
  listOpen({ cursor = null, maxResults = DEFAULT_MAX_QUERY_RESULTS }: { cursor?: string | null; maxResults?: number }) {
    return this.entity.query
      .sortedByCloseTime({})
      .gte({ closeTime: new Date().toISOString() })
      .go({ cursor, limit: maxResults });
  }
}

export const leaderboardDao = new LeaderboardDao(LeaderboardsEntity);
