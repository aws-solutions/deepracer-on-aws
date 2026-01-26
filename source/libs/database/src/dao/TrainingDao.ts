// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
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
}

export const trainingDao = new TrainingDao(TrainingsEntity);
