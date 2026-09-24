// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeploymentStatus } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { DeploymentEntity } from '../entities/DeploymentEntity.js';
import type { ResourceId } from '../types/resource.js';

/**
 * Data access for {@link DeploymentEntity}.
 *
 * Inherits create/get/load/delete/update/partialUpdate from {@link BaseDao}.
 * Listing is served by the primary table (byModel), GSI1 (byBatch), and GSI2 (byEvent).
 */
export class DeploymentDao extends BaseDao<DeploymentEntity> {
  /** Lists deployments for a model (paginated, for API responses). */
  @logMethod
  listByModel({
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

  /** Lists ALL deployments for a model (unpaginated, for internal checks). */
  @logMethod
  async listAllByModel({ modelId }: { modelId: ResourceId }) {
    const { data } = await this.entity.query.byModelId({ modelId }).go({ pages: 'all' });
    return data;
  }

  /** Lists all deployments in a batch, ordered by createdAt. */
  @logMethod
  listByBatch({
    batchId,
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    batchId: ResourceId;
    cursor?: string | null;
    maxResults?: number;
  }) {
    return this.entity.query.byBatchId({ batchId }).go({ cursor, limit: maxResults });
  }

  /** Lists all deployments for an event, ordered by createdAt (paginated). */
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
    return this.entity.query.byEventId({ eventId }).go({ cursor, limit: maxResults });
  }

  /**
   * Updates the status of a deployment and conditionally sets timestamps and error message.
   * Guarded by a `.where()` condition on expected current status to prevent out-of-order writes.
   * Transitions: PENDING -> IN_PROGRESS -> COMPLETED | FAILED.
   */
  @logMethod
  async updateStatus({
    modelId,
    deploymentId,
    status,
    expectedStatus,
    errorMessage,
  }: {
    modelId: ResourceId;
    deploymentId: ResourceId;
    status: DeploymentStatus;
    expectedStatus: DeploymentStatus;
    errorMessage?: string;
  }) {
    const now = new Date().toISOString();

    const updates: {
      status: DeploymentStatus;
      uploadStartedAt?: string;
      completedAt?: string;
      errorMessage?: string;
    } = { status };

    if (status === DeploymentStatus.IN_PROGRESS) {
      updates.uploadStartedAt = now;
    }

    if (status === DeploymentStatus.COMPLETED || status === DeploymentStatus.FAILED) {
      updates.completedAt = now;
    }

    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }

    const response = await this.entity
      .patch({ modelId, deploymentId })
      .set(updates)
      .add({ [DynamoDBItemAttribute.VERSION]: 1 } as unknown as Record<string, number>)
      .where((attr, { eq }) => eq(attr.status, expectedStatus))
      .go({ response: 'all_new' });

    return response.data;
  }
}

export const deploymentDao = new DeploymentDao(DeploymentEntity);
