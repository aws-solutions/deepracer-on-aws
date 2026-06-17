// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { LeaderboardsEntity } from '../entities/LeaderboardsEntity.js';
import type { ResourceId } from '../types/resource.js';

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

  /**
   * Clear execution lock. Only clears if the ARN matches (or unconditionally if no ARN provided).
   */
  @logMethod
  async clearExecutionLock(leaderboardId: ResourceId, expectedArn?: string): Promise<void> {
    let query = this.entity.patch({ leaderboardId }).set({ currentExecutionArn: '' });
    if (expectedArn) {
      query = query.where(({ currentExecutionArn: arn }, { eq }) => eq(arn, expectedArn));
    }
    await query.go();
  }

  /**
   * Acquire execution lock via conditional write. Sets the ARN, status, and autolaunch
   * only if currentExecutionArn is currently empty. Throws if another execution already holds the lock.
   */
  @logMethod
  async acquireExecutionLock(leaderboardId: ResourceId, executionArn: string): Promise<void> {
    await this.entity
      .patch({ leaderboardId })
      .set({
        currentExecutionArn: executionArn,
        liveEventStatus: LiveEventStatus.IN_PROGRESS,
      })
      .where(({ currentExecutionArn: arn }, { eq, notExists }) => `(${notExists(arn)} OR ${eq(arn, '')})`)
      .go();
  }

  /**
   * Declare winner via conditional write. Sets winnerId, winnerDeclaredAt, and liveEventStatus to COMPLETED
   * only if no execution is running and status is still IN_PROGRESS.
   */
  @logMethod
  async declareWinner(
    leaderboardId: ResourceId,
    attrs: { winnerId?: ResourceId; winnerDeclaredAt: string },
  ): Promise<void> {
    const inProgress: string = LiveEventStatus.IN_PROGRESS;
    await this.entity
      .patch({ leaderboardId })
      .set({
        ...attrs,
        liveEventStatus: LiveEventStatus.COMPLETED,
      })
      .where(
        ({ currentExecutionArn: arn, liveEventStatus: status }, { eq, notExists }) =>
          `(${notExists(arn)} OR ${eq(arn, '')}) AND ${eq(status, inProgress)}`,
      )
      .go();
  }
}

export const leaderboardDao = new LeaderboardDao(LeaderboardsEntity);
