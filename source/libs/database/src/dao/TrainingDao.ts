// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { STOPPABLE_JOB_STATUSES } from '../constants/stoppableJobStatuses.js';
import { TrainingsEntity } from '../entities/TrainingsEntity.js';
import type { ResourceId } from '../types/resource.js';

export class TrainingDao extends BaseDao<TrainingsEntity> {
  /**
   * Attempts to retrieve a stoppable training.
   *
   * @param modelId The model ID used in the query
   * @returns A training in a stoppable status, or null if none is found
   */
  @logMethod
  async getStoppableTraining(modelId: ResourceId) {
    const { data: trainingItems } = await this.entity.query
      .byModelId({ modelId })
      .where((attr, { eq }) => STOPPABLE_JOB_STATUSES.map((status) => `${eq(attr.status, status)}`).join(' OR '))
      .go({ pages: 'all' });

    return trainingItems.length ? trainingItems[0] : null;
  }

  /**
   * Conditionally moves the training job from one status to another, optionally setting (or
   * clearing) `statusMessage` in the same write.
   *
   * @throws a DynamoDB `ConditionalCheckFailedException` (wrapped by ElectroDB) when the job is no
   * longer in the `from` status. Use {@link isConditionalCheckFailure} to detect it.
   */
  @logMethod
  async transitionStatus(
    { modelId }: { modelId: ResourceId },
    { from, to, statusMessage }: { from: JobStatus; to: JobStatus; statusMessage?: string },
  ): Promise<void> {
    const fromValue: string = from;
    const patch = this.entity
      .patch({ modelId })
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

export const trainingDao = new TrainingDao(TrainingsEntity);
