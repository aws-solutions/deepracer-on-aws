// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CombinedScoringStrategy, EventStatus } from '@deepracer-indy/typescript-server-client';

import { ResourceType } from '#constants/resourceTypes.js';
import { EventItem, EventsEntity } from '#entities/EventsEntity.js';
import { generateResourceId } from '#utils/resourceUtils.js';

import { TEST_EVENT_ITEM, TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';

describe('EventsEntity', () => {
  describe('create()', () => {
    it('should create items with the correct properties and defaults', async () => {
      const name = generateResourceId();

      await EventsEntity.create({ ...TEST_EVENT_ITEM, name }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem).toEqual({
        ...TEST_EVENT_ITEM,
        name,
        updatedAt: expect.any(String),
        pk: ResourceType.EVENTS,
        sk: expect.stringMatching(/^event#[A-Za-z0-9-]{15}$/),
        version: 1,
        __edb_e__: ResourceType.EVENT,
        __edb_v__: '1',
      });
    });

    it('should create items with a combinedScoringStrategy when provided', async () => {
      const combinedScoringStrategy = CombinedScoringStrategy.BEST_RESULT_PER_RACER;

      await EventsEntity.create({ ...TEST_EVENT_ITEM, combinedScoringStrategy }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem.combinedScoringStrategy).toBe(combinedScoringStrategy);
    });

    it('should create items with a sponsor when provided', async () => {
      const sponsor = 'AWS re:Invent';

      await EventsEntity.create({ ...TEST_EVENT_ITEM, sponsor }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem.sponsor).toBe(sponsor);
    });

    it('should default eventStatus to DRAFT', async () => {
      const { eventStatus: _ignored, ...itemWithoutStatus } = TEST_EVENT_ITEM;

      await EventsEntity.create(itemWithoutStatus as Parameters<EventsEntity['create']>[0]).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem.eventStatus).toBe(EventStatus.DRAFT);
    });

    it('should create items without maxRunsPerRacer (unlimited runs per racer)', async () => {
      const { maxRunsPerRacer: _ignored, ...itemWithoutMaxRunsPerRacer } = TEST_EVENT_ITEM;

      await EventsEntity.create(itemWithoutMaxRunsPerRacer as Parameters<EventsEntity['create']>[0]).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem.maxRunsPerRacer).toBeUndefined();
    });

    it('should create items with an averageLapsWindow when provided', async () => {
      const averageLapsWindow = 5;

      await EventsEntity.create({ ...TEST_EVENT_ITEM, averageLapsWindow }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem.averageLapsWindow).toBe(averageLapsWindow);
    });

    it('should create items without averageLapsWindow (defaults to averaging all valid laps)', async () => {
      const { averageLapsWindow: _ignored, ...itemWithoutWindow } = TEST_EVENT_ITEM;

      await EventsEntity.create(itemWithoutWindow as Parameters<EventsEntity['create']>[0]).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const eventItem = Items?.[0] as EventItem;

      expect(eventItem.averageLapsWindow).toBeUndefined();
    });
  });
});
