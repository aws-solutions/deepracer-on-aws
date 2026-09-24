// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceType } from '#constants/resourceTypes.js';
import { LapsEntity } from '#entities/LapsEntity.js';
import { LapTokenEntity } from '#entities/LapTokenEntity.js';

import { TEST_LEADERBOARD_ID, TEST_RUN_ID, TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';

const TEST_TOKEN_BASE = {
  leaderboardId: TEST_LEADERBOARD_ID,
  runId: TEST_RUN_ID,
  clientToken: 'token-abc',
  lapNumber: 1,
  ttl: Math.floor(Date.now() / 1000) + 86_400,
};

describe('LapTokenEntity', () => {
  describe('create()', () => {
    it('should create items with the correct primary key structure', async () => {
      await LapTokenEntity.create(TEST_TOKEN_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenItem = Items?.[0] as any;

      // Shares the lap PK so the guard lives in the lap's item collection.
      expect(tokenItem.pk).toBe(`leaderboard_${TEST_LEADERBOARD_ID}#run_${TEST_RUN_ID}`);
      expect(tokenItem.sk).toBe('laptoken_token-abc');
    });

    it('should persist the ttl attribute for DynamoDB TTL expiry', async () => {
      await LapTokenEntity.create(TEST_TOKEN_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenItem = Items?.[0] as any;

      expect(tokenItem.ttl).toBe(TEST_TOKEN_BASE.ttl);
    });

    it('should set __edb_e__ to the lap-token entity type', async () => {
      await LapTokenEntity.create(TEST_TOKEN_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenItem = Items?.[0] as any;

      expect(tokenItem.__edb_e__).toBe(ResourceType.LAP_TOKEN);
    });

    it('should reject a duplicate clientToken via the sort-key existence guard', async () => {
      await LapTokenEntity.create(TEST_TOKEN_BASE).go();

      // ElectroDB create() applies attribute_not_exists on the key — a replay must fail.
      await expect(LapTokenEntity.create(TEST_TOKEN_BASE).go()).rejects.toThrow();
    });

    it('should coexist as a separate item alongside the lap it guards in the same partition', async () => {
      await LapsEntity.create({
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        lapNumber: 1,
        lapTimeMs: 12345,
        resets: 0,
      }).go();
      await LapTokenEntity.create(TEST_TOKEN_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      // Two distinct items under the same PK: lap_1 and laptoken_token-abc.
      const sortKeys = (Items ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.sk)
        .sort();
      expect(sortKeys).toEqual(['lap_1', 'laptoken_token-abc']);
      // The lap item has no ttl attribute, so DynamoDB TTL never expires it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lapItem = (Items ?? []).find((item: any) => item.sk === 'lap_1') as any;
      expect(lapItem.ttl).toBeUndefined();
    });
  });
});
