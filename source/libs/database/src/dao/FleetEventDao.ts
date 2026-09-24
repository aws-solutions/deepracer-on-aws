// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { FleetEventEntity } from '../entities/FleetEventEntity.js';
import type { ResourceId } from '../types/resource.js';

/**
 * Data access for {@link FleetEventEntity} (fleet <-> event assignments).
 *
 */
export class FleetEventDao extends BaseDao<FleetEventEntity> {
  @logMethod
  assign({ eventId, fleetId }: { eventId: ResourceId; fleetId: ResourceId }) {
    return this._create({ eventId, fleetId });
  }

  @logMethod
  unassign({ eventId, fleetId }: { eventId: ResourceId; fleetId: ResourceId }) {
    return this._delete({ eventId, fleetId });
  }

  @logMethod
  async listFleetsByEvent(eventId: ResourceId) {
    const { data } = await this.entity.query.byEventId({ eventId }).go({ pages: 'all' });
    return data;
  }

  @logMethod
  async listEventsByFleet(fleetId: ResourceId) {
    const { data } = await this.entity.query.byFleetId({ fleetId }).go({ pages: 'all' });
    return data;
  }
}

export const fleetEventDao = new FleetEventDao(FleetEventEntity);
