// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceType } from '#constants/resourceTypes.js';
import { LapsEntity } from '#entities/LapsEntity.js';
import { generateResourceId } from '#utils/resourceUtils.js';

import { TEST_LEADERBOARD_ID, TEST_RUN_ID, TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';

const TEST_LAP_BASE = {
  lapNumber: 1,
  lapTimeMs: 12345,
  leaderboardId: TEST_LEADERBOARD_ID,
  runId: TEST_RUN_ID,
  resets: 0,
};

describe('LapsEntity', () => {
  describe('create()', () => {
    it('should create items with the correct primary key structure', async () => {
      await LapsEntity.create(TEST_LAP_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lapItem = Items?.[0] as any;

      expect(lapItem.pk).toBe(`leaderboard_${TEST_LEADERBOARD_ID}#run_${TEST_RUN_ID}`);
      expect(lapItem.sk).toBe('lap_1');
    });

    it('should default isValid to true', async () => {
      await LapsEntity.create(TEST_LAP_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lapItem = Items?.[0] as any;

      expect(lapItem.isValid).toBe(true);
    });

    it('should store optional audit fields when provided', async () => {
      const editedBy = generateResourceId();
      const editedAt = new Date().toISOString();

      await LapsEntity.create({
        ...TEST_LAP_BASE,
        originalLapTimeMs: 11111,
        editedBy,
        editedAt,
        editReason: 'Corrected timer',
      }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lapItem = Items?.[0] as any;

      expect(lapItem.originalLapTimeMs).toBe(11111);
      expect(lapItem.editedBy).toBe(editedBy);
      expect(lapItem.editReason).toBe('Corrected timer');
    });

    it('should store optional deviceId when provided', async () => {
      const deviceId = generateResourceId();

      await LapsEntity.create({ ...TEST_LAP_BASE, deviceId }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lapItem = Items?.[0] as any;

      expect(lapItem.deviceId).toBe(deviceId);
    });
    it('should set __edb_e__ to the lap entity type', async () => {
      await LapsEntity.create(TEST_LAP_BASE).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lapItem = Items?.[0] as any;

      expect(lapItem.__edb_e__).toBe(ResourceType.LAP);
    });
  });
});
