// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { EvaluationsEntity } from '../../entities/EvaluationsEntity.js';
import type { ResourceId } from '../../types/resource.js';
import { decodeCursor, encodeCursor } from '../../utils/cursorUtils.js';
import { EvaluationDao } from '../EvaluationDao.js';

/**
 * Metrics-specific DAO for evaluation operations
 * Extends EvaluationDao to provide metrics-specific functionality
 */
export class MetricsEvaluationDao extends EvaluationDao {
  /**
   * List evaluation IDs for a specific model with pagination support
   * @param modelId - The model ID to get evaluation IDs for
   * @param cursor - Optional cursor for pagination
   * @param maxResults - Maximum number of results to return
   * @returns Promise with evaluation IDs and cursor for pagination
   */
  @logMethod
  async listEvaluationIds({
    modelId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    modelId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    const result = await this.entity.query.byModelId({ modelId }).go({
      attributes: [DynamoDBItemAttribute.EVALUATION_ID],
      limit: maxResults,
      cursor: decodeCursor(cursor),
    });

    return {
      data: result.data.map((evaluation) => evaluation.evaluationId),
      cursor: encodeCursor(result.cursor),
    };
  }

  /**
   * Count evaluation jobs for a specific model
   * @param modelId - The model ID to count evaluation jobs for
   * @returns Promise<number> The count of evaluation jobs for the model
   */
  @logMethod
  async countEvaluationJobsByModel(modelId: ResourceId): Promise<number> {
    let totalCount = 0;
    let cursor: string | null = null;

    do {
      const result = await this.listEvaluationIds({ modelId, cursor });
      totalCount += result.data.length;
      cursor = result.cursor;
    } while (cursor);

    return totalCount;
  }
}

export const metricsEvaluationDao = new MetricsEvaluationDao(EvaluationsEntity);
