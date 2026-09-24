// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RunStatus } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { RunsEntity } from '../entities/RunsEntity.js';
import type { ResourceId } from '../types/resource.js';

export class RunDao extends BaseDao<RunsEntity> {
  @logMethod
  list({
    leaderboardId,
    eventId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    status,
  }: {
    leaderboardId: ResourceId;
    eventId?: ResourceId;
    cursor?: string | null;
    maxResults?: number;
    status?: RunStatus;
  }) {
    const query = this.entity.query.byLeaderboardId({ leaderboardId });
    if (status === undefined && eventId === undefined) {
      return query.go({ cursor, limit: maxResults });
    }
    return query
      .where((attr, op) => {
        const conditions: string[] = [];
        if (status !== undefined) {
          conditions.push(op.eq(attr[DynamoDBItemAttribute.RUN_STATUS], status));
        }
        if (eventId !== undefined) {
          conditions.push(op.eq(attr[DynamoDBItemAttribute.EVENT_ID], eventId));
        }
        return conditions.join(' AND ');
      })
      .go({ cursor, limit: maxResults });
  }

  @logMethod
  listByRacerInEvent({
    eventId,
    profileId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    eventId: ResourceId;
    profileId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    return this.entity.query.byRacerInEvent({ eventId, profileId }).go({ cursor, limit: maxResults });
  }

  /**
   * Lists ALL runs for an event, regardless of track (leaderboard) or racer.
   * Used by statistics aggregation, which needs every run across every track.
   */
  @logMethod
  async listAllByEvent({ eventId, maxResults }: { eventId: ResourceId; maxResults?: number }) {
    const query = this.entity.query.byEventId({ eventId });
    if (maxResults !== undefined) {
      const { data } = await query.go({ limit: maxResults });
      return data;
    }
    const { data } = await query.go({ pages: 'all' });
    return data;
  }
  /* Transitions a run to a new status via a conditional write guarded on the
   * expected current status. If another request has already changed
   * the run's status, ElectroDB throws a ConditionalCheckFailedException —
   * callers should catch this and surface a 409 Conflict.
   */
  @logMethod
  async transitionStatus({
    leaderboardId,
    runId,
    status,
    expectedStatus,
  }: {
    leaderboardId: ResourceId;
    runId: ResourceId;
    status: RunStatus;
    expectedStatus: RunStatus;
  }) {
    const response = await this.entity
      .patch({ leaderboardId, runId })
      .set({ [DynamoDBItemAttribute.RUN_STATUS]: status })
      .where((attr, { eq }) => eq(attr[DynamoDBItemAttribute.RUN_STATUS], expectedStatus))
      .go({ response: 'all_new' });

    return response.data;
  }
}

export const runDao = new RunDao(RunsEntity);
