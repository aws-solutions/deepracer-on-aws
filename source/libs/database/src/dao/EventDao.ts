// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus, NotFoundError } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { ErrorMessage } from '../constants/errorMessages.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { EventsEntity } from '../entities/EventsEntity.js';
import type { ResourceId } from '../types/resource.js';

export class EventDao extends BaseDao<EventsEntity> {
  @logMethod
  list({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    status,
  }: {
    cursor?: string | null;
    maxResults?: number;
    status?: EventStatus;
  }) {
    const deleting: string = EventStatus.DELETING;
    const query = this.entity.query
      .byEventId({})
      .where((attr, op) => op.ne(attr[DynamoDBItemAttribute.EVENT_STATUS], deleting));
    if (status) {
      return query
        .where((attr, op) => op.eq(attr[DynamoDBItemAttribute.EVENT_STATUS], status))
        .go({ cursor, limit: maxResults });
    }
    return query.go({ cursor, limit: maxResults });
  }

  /**
   * Loads an event for API-facing operations.
   *
   * DELETING is a system-internal state: API callers must observe the event as
   * not found while the deletion worker uses the raw get() method to retain the
   * root item for retry-safe cascade traversal.
   */
  @logMethod
  override async load(primaryKey: { eventId: ResourceId }) {
    const event = await super.load(primaryKey);
    if (event.eventStatus === EventStatus.DELETING) {
      throw new NotFoundError({ message: ErrorMessage.ITEM_NOT_FOUND });
    }
    return event;
  }
  /**
   * Transitions an event to DELETING status via a conditional write.
   * The condition asserts that the current status is NOT already DELETING,
   * which eliminates the TOCTOU race between concurrent delete requests.
   *
   * @throws ConditionalCheckFailedException if the event is already in DELETING status.
   *   The caller should catch this, re-enqueue the deletion message, and return the idempotent 202 response.
   */
  @logMethod
  transitionToDeleting(eventId: ResourceId) {
    const deleting: string = EventStatus.DELETING;
    return this.entity
      .patch({ eventId })
      .set({ [DynamoDBItemAttribute.EVENT_STATUS]: EventStatus.DELETING })
      .where(({ eventStatus }, { ne }) => ne(eventStatus, deleting))
      .go();
  }

  /**
   * Transitions an event from one status to another via a single conditional write.
   * The condition asserts that the current status equals `from`, eliminating the
   * TOCTOU race that would occur with a separate read-then-write.
   *
   * @throws ConditionalCheckFailedException if the current status != from (concurrent transition).
   *   The caller should surface this as a 409 ConflictError.
   */
  @logMethod
  transitionStatus(eventId: ResourceId, from: EventStatus, to: EventStatus) {
    const fromValue: string = from;
    return this.entity
      .patch({ eventId })
      .set({ [DynamoDBItemAttribute.EVENT_STATUS]: to })
      .add({ [DynamoDBItemAttribute.VERSION]: 1 })
      .where(({ eventStatus }, { eq }) => eq(eventStatus, fromValue))
      .go();
  }
}

export const eventDao = new EventDao(EventsEntity);
