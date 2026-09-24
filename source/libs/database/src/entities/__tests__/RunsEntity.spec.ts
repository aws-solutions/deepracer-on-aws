// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RunStatus } from '@deepracer-indy/typescript-server-client';

import { ResourceType } from '#constants/resourceTypes.js';
import { RunsEntity } from '#entities/RunsEntity.js';

import {
  TEST_EVENT_ID,
  TEST_LEADERBOARD_ID,
  TEST_PROFILE_ID_1,
  TEST_RUN_ITEM,
  TEST_TABLE_NAME,
} from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';

describe('RunsEntity', () => {
  describe('create()', () => {
    it('should create items with the correct primary key structure', async () => {
      await RunsEntity.create(TEST_RUN_ITEM).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.pk).toBe(`leaderboard_${TEST_LEADERBOARD_ID}`);
      expect(runItem.sk).toMatch(/^run_[A-Za-z0-9-]{15}$/);
    });

    it('should default runStatus to READY', async () => {
      const { runStatus: _ignored, ...withoutStatus } = TEST_RUN_ITEM;
      await RunsEntity.create(withoutStatus as Parameters<RunsEntity['create']>[0]).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.runStatus).toBe(RunStatus.READY);
    });

    it('should populate GSI1 PK with event + profile composite key', async () => {
      await RunsEntity.create(TEST_RUN_ITEM).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.gsi1pk).toBe(`event_${TEST_EVENT_ID}#profile_${TEST_PROFILE_ID_1}`);
    });

    it('should populate GSI2 PK with eventId only, for cross-track/racer event queries', async () => {
      await RunsEntity.create(TEST_RUN_ITEM).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.gsi2pk).toBe(`event_${TEST_EVENT_ID}`);
    });

    it('should store racedByProxy when provided', async () => {
      await RunsEntity.create({ ...TEST_RUN_ITEM, racedByProxy: true }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.racedByProxy).toBe(true);
    });

    it('should set __edb_e__ to the run entity type', async () => {
      await RunsEntity.create(TEST_RUN_ITEM).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.__edb_e__).toBe(ResourceType.RUN);
    });

    it('should default lapCount to 0', async () => {
      await RunsEntity.create(TEST_RUN_ITEM).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runItem = Items?.[0] as any;

      expect(runItem.lapCount).toBe(0);
    });
  });
});
