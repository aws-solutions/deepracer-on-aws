// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { CarLogFetchJobEntity } from '../entities/CarLogFetchJobEntity.js';
import type { ResourceId } from '../types/resource.js';

const TERMINAL_STATUSES: readonly CarLogFetchStatus[] = [
  CarLogFetchStatus.DONE,
  CarLogFetchStatus.FAILED,
  CarLogFetchStatus.UPLOAD_FAILED,
];

/** Job records are operational history; keep them for 90 days. */
const JOB_TTL_SECONDS = 90 * 24 * 60 * 60;

export const isTerminalCarLogFetchStatus = (status: CarLogFetchStatus) => TERMINAL_STATUSES.includes(status);

/**
 * Data access for {@link CarLogFetchJobEntity}.
 */
export class CarLogFetchJobDao extends BaseDao<CarLogFetchJobEntity> {
  /** Creates a job in CREATED (car fetch) or WAITING_FOR_UPLOAD (manual upload) state with a TTL. */
  @logMethod
  createJob(item: Omit<Parameters<CarLogFetchJobEntity['create']>[0], 'ttl'>) {
    return this._create({ ...item, ttl: Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS });
  }

  /** Lists all jobs, newest first. */
  @logMethod
  list({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: { cursor?: string | null; maxResults?: number } = {}) {
    return this.entity.query.byCreatedAt({}).go({ cursor, limit: maxResults, order: 'desc' });
  }

  /** Lists the jobs of an event, newest first. */
  @logMethod
  listByEvent({
    eventId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    eventId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    return this.entity.query.byEventId({ eventId }).go({ cursor, limit: maxResults, order: 'desc' });
  }

  /** Lists a car's jobs that are not yet in a terminal state. */
  @logMethod
  async listActiveByInstance({ instanceId }: { instanceId: string }) {
    const { data } = await this.entity.query
      .byCreatedAt({})
      .where(
        ({ instanceId: attr, status }, { eq, ne }) =>
          `${eq(attr, instanceId)} AND ${TERMINAL_STATUSES.map((terminal) => ne(status, terminal)).join(' AND ')}`,
      )
      .go({ pages: 'all', order: 'desc' });
    return data;
  }

  /**
   * Moves a job to `status`. Jobs that already reached a terminal state are never changed, so a
   * late or duplicate step cannot resurrect a finished job; callers get a ConditionalCheckFailed
   * error in that case (see `isConditionalCheckFailed`).
   */
  @logMethod
  async updateStatus({
    jobId,
    status,
    errorMessage,
    attributes = {},
  }: {
    jobId: ResourceId;
    status: CarLogFetchStatus;
    errorMessage?: string;
    attributes?: { ssmCommandId?: string; batchJobId?: string; executionArn?: string; uploadKey?: string };
  }) {
    const updates = {
      ...attributes,
      status,
      ...(errorMessage !== undefined && { errorMessage }),
      ...(isTerminalCarLogFetchStatus(status) && { endedAt: new Date().toISOString() }),
    };

    const response = await this.entity
      .patch({ jobId })
      .set(updates)
      .add({ [DynamoDBItemAttribute.VERSION]: 1 } as unknown as Record<string, number>)
      .where(({ status: current }, { ne }) => TERMINAL_STATUSES.map((terminal) => ne(current, terminal)).join(' AND '))
      .go({ response: 'all_new' });

    return response.data;
  }
}

export const carLogFetchJobDao = new CarLogFetchJobDao(CarLogFetchJobEntity);
