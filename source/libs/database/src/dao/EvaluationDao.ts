// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { STOPPABLE_JOB_STATUSES } from '../constants/stoppableJobStatuses.js';
import { EvaluationsEntity } from '../entities/EvaluationsEntity.js';
import type { ResourceId } from '../types/resource.js';

export class EvaluationDao extends BaseDao<EvaluationsEntity> {
  @logMethod
  list({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    modelId,
  }: {
    cursor?: string | null;
    maxResults?: number;
    modelId: ResourceId;
  }) {
    return this.entity.query.byModelId({ modelId }).go({ cursor, limit: maxResults });
  }

  /**
   * Attempts to retrieve a stoppable evaluation.
   *
   * @param modelId The model ID used in the query
   * @returns An evaluation in a stoppable status, or null if none is found
   */
  @logMethod
  async getStoppableEvaluation(modelId: ResourceId) {
    const { data: evaluationItems } = await this.entity.query
      .byModelId({ modelId })
      .where((attr, { eq }) => STOPPABLE_JOB_STATUSES.map((status) => `${eq(attr.status, status)}`).join(' OR '))
      .go({ pages: 'all' });

    return evaluationItems.length ? evaluationItems[0] : null;
  }
}

export const evaluationDao = new EvaluationDao(EvaluationsEntity);
