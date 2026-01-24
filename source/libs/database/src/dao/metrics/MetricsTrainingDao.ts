// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { TrainingsEntity } from '../../entities/TrainingsEntity.js';
import type { ResourceId } from '../../types/resource.js';
import { decodeCursor, encodeCursor } from '../../utils/cursorUtils.js';
import { TrainingDao } from '../TrainingDao.js';

/**
 * Metrics-specific DAO for training operations
 * Extends TrainingDao to provide metrics-specific functionality
 */
export class MetricsTrainingDao extends TrainingDao {
  /**
   * List training jobs for a specific model with pagination support
   * @param modelId - The model ID to get training jobs for
   * @param cursor - Optional cursor for pagination
   * @param maxResults - Maximum number of results to return
   * @returns Promise with training jobs and cursor for pagination
   */
  @logMethod
  async list({
    modelId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    modelId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    return this.entity.query.byModelId({ modelId }).go({ cursor, limit: maxResults });
  }

  /**
   * List training job names for a specific model with pagination support
   * @param modelId - The model ID to get training job names for
   * @param cursor - Optional cursor for pagination
   * @param maxResults - Maximum number of results to return
   * @returns Promise with training job names and cursor for pagination
   */
  @logMethod
  async listTrainingNames({
    modelId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    modelId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    const result = await this.entity.query.byModelId({ modelId }).go({
      attributes: [DynamoDBItemAttribute.NAME],
      limit: maxResults,
      cursor: decodeCursor(cursor),
    });

    return {
      data: result.data.map((training) => training.name),
      cursor: encodeCursor(result.cursor),
    };
  }

  /**
   * Count training jobs for a specific model
   * @param modelId - The model ID to count training jobs for
   * @returns Promise<number> The count of training jobs for the model
   */
  @logMethod
  async countTrainingJobsByModel(modelId: ResourceId): Promise<number> {
    let totalCount = 0;
    let cursor: string | null = null;

    do {
      const result = await this.listTrainingNames({ modelId, cursor });
      totalCount += result.data.length;
      cursor = result.cursor;
    } while (cursor);

    return totalCount;
  }
}

// Create an instance for use in metrics collection
export const metricsTrainingDao = new MetricsTrainingDao(TrainingsEntity);
