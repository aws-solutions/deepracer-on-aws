// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { FleetEntity } from '../entities/FleetEntity.js';

/**
 * Data access for {@link FleetEntity}.
 *
 */
export class FleetDao extends BaseDao<FleetEntity> {
  @logMethod
  list({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: { cursor?: string | null; maxResults?: number } = {}) {
    return this.entity.scan.go({ cursor, limit: maxResults });
  }
}

export const fleetDao = new FleetDao(FleetEntity);
