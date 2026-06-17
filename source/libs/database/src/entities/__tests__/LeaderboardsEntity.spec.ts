// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getDbKeyRegex } from '#constants/regex.js';
import { ResourceType } from '#constants/resourceTypes.js';
import { LeaderboardItem, LeaderboardsEntity } from '#entities/LeaderboardsEntity.js';
import { generateResourceId } from '#utils/resourceUtils.js';

import { TEST_LEADERBOARD_ITEM, TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';

describe('LeaderboardsEntity', () => {
  describe('create()', () => {
    it('should create items with the correct properties and defaults', async () => {
      const name = generateResourceId();

      await LeaderboardsEntity.create({ ...TEST_LEADERBOARD_ITEM, name }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const leaderboardItem = Items?.[0] as LeaderboardItem;

      expect(leaderboardItem).toEqual({
        ...TEST_LEADERBOARD_ITEM,
        name,
        autoLaunchEnabled: false,
        isLive: false,
        submissionPeriodOpen: false,
        updatedAt: expect.any(String),
        pk: ResourceType.LEADERBOARDS,
        sk: expect.stringMatching(getDbKeyRegex(ResourceType.LEADERBOARD)),
        version: 1,
        __edb_e__: ResourceType.LEADERBOARD,
        __edb_v__: '1',
      });
    });

    it('should create items with correct properties and non-defaults', async () => {
      const NON_DEFAULT_VALUES = {
        name: generateResourceId(),
        isLive: true,
        maxResets: 42,
        submissionPeriodOpen: true,
      };
      await LeaderboardsEntity.create({
        ...TEST_LEADERBOARD_ITEM,
        ...NON_DEFAULT_VALUES,
      }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const leaderboardItem = Items?.[0] as LeaderboardItem;

      expect(leaderboardItem).toEqual({
        ...TEST_LEADERBOARD_ITEM,
        ...NON_DEFAULT_VALUES,
        autoLaunchEnabled: false,
        updatedAt: expect.any(String),
        pk: ResourceType.LEADERBOARDS,
        sk: expect.stringMatching(getDbKeyRegex(ResourceType.LEADERBOARD)),
        version: 1,
        __edb_e__: ResourceType.LEADERBOARD,
        __edb_v__: '1',
      });
    });
  });
});
