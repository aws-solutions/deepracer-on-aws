// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
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
}

export const modelDao = new ModelDao(ModelsEntity);
