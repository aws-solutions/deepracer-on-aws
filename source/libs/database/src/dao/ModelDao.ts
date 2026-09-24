// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { ModelsEntity } from '../entities/ModelsEntity.js';
import type { ResourceId } from '../types/resource.js';

export class ModelDao extends BaseDao<ModelsEntity> {
  @logMethod
  list({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    profileId,
  }: {
    cursor?: string | null;
    maxResults?: number;
    profileId: ResourceId;
  }) {
    return this.entity.query.byProfileId({ profileId }).go({ cursor, limit: maxResults });
  }

  @logMethod
  listAll({ profileId }: { profileId: ResourceId }) {
    return this.entity.query.byProfileId({ profileId }).go({ pages: 'all' });
  }

  /**
   * Conditionally sets optimizationStatus to FAILED only if still IN_PROGRESS.
   */
  @logMethod
  async setOptimizationFailed({ modelId, profileId }: { modelId: ResourceId; profileId: ResourceId }): Promise<void> {
    await this.entity
      .patch({ modelId, profileId })
      .set({ optimizationStatus: 'FAILED' })
      .add({ version: 1 })
      .where((attr, { eq }) => eq(attr.optimizationStatus, 'IN_PROGRESS'))
      .go();
  }

  /**
   * Conditionally moves the model from one status to another, optionally setting (or clearing)
   * `statusMessage` in the same write.
   *
   * The transition is the concurrency gate for the training-capacity flow: only the caller that
   * wins `WAITING_FOR_CAPACITY -> QUEUED` may dispatch a workflow message, so a double-clicked
   * retry cannot produce duplicate SQS messages.
   *
   * @throws a DynamoDB `ConditionalCheckFailedException` (wrapped by ElectroDB) when the model is
   * no longer in the `from` status. Use {@link isConditionalCheckFailure} to detect it.
   */
  @logMethod
  async transitionStatus(
    { modelId, profileId }: { modelId: ResourceId; profileId: ResourceId },
    { from, to, statusMessage }: { from: ModelStatus; to: ModelStatus; statusMessage?: string },
  ): Promise<void> {
    const fromValue: string = from;
    const patch = this.entity
      .patch({ modelId, profileId })
      .set({ [DynamoDBItemAttribute.STATUS]: to })
      .add({ [DynamoDBItemAttribute.VERSION]: 1 });

    // The set/remove of statusMessage has to be chained before `where`, which narrows the builder.
    const withStatusMessage =
      statusMessage === undefined
        ? patch.remove([DynamoDBItemAttribute.STATUS_MESSAGE])
        : patch.set({ [DynamoDBItemAttribute.STATUS_MESSAGE]: statusMessage });

    await withStatusMessage.where((attr, { eq }) => eq(attr.status, fromValue)).go();
  }
}

export const modelDao = new ModelDao(ModelsEntity);
