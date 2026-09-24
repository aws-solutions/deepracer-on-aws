// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrackId } from '@deepracer-indy/typescript-server-client';

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

    it('should create a standalone virtual leaderboard without eventId, fleetId, or trackType', async () => {
      const name = generateResourceId();

      await LeaderboardsEntity.create({ ...TEST_LEADERBOARD_ITEM, name }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const leaderboardItem = Items?.[0] as LeaderboardItem;

      expect(leaderboardItem.eventId).toBeUndefined();
      expect(leaderboardItem.fleetId).toBeUndefined();
      expect(leaderboardItem.trackType).toBeUndefined();
    });

    it('should create an event track leaderboard with eventId, fleetId, and trackType', async () => {
      const name = generateResourceId();
      const eventId = generateResourceId();
      const fleetId = generateResourceId();

      await LeaderboardsEntity.create({
        ...TEST_LEADERBOARD_ITEM,
        name,
        eventId,
        fleetId,
        trackType: TrackId.ACE_SPEEDWAY,
      }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const leaderboardItem = Items?.[0] as LeaderboardItem;

      expect(leaderboardItem).toMatchObject({
        eventId,
        fleetId,
        trackType: TrackId.ACE_SPEEDWAY,
      });
    });
  });

  describe('byEventId (sparse GSI)', () => {
    it('should isolate leaderboards per event and exclude standalone virtual leaderboards', async () => {
      const eventA = generateResourceId();
      const eventB = generateResourceId();

      const [eventALb1, eventALb2, eventBLb1] = await Promise.all([
        LeaderboardsEntity.create({
          ...TEST_LEADERBOARD_ITEM,
          leaderboardId: generateResourceId(),
          name: generateResourceId(),
          eventId: eventA,
        }).go(),
        LeaderboardsEntity.create({
          ...TEST_LEADERBOARD_ITEM,
          leaderboardId: generateResourceId(),
          name: generateResourceId(),
          eventId: eventA,
        }).go(),
        LeaderboardsEntity.create({
          ...TEST_LEADERBOARD_ITEM,
          leaderboardId: generateResourceId(),
          name: generateResourceId(),
          eventId: eventB,
        }).go(),
        // Standalone virtual leaderboard — no eventId, must not appear in the sparse index.
        LeaderboardsEntity.create({
          ...TEST_LEADERBOARD_ITEM,
          leaderboardId: generateResourceId(),
          name: generateResourceId(),
        }).go(),
      ]);

      const eventAResult = await LeaderboardsEntity.query.byEventId({ eventId: eventA }).go();
      const eventBResult = await LeaderboardsEntity.query.byEventId({ eventId: eventB }).go();

      const eventALeaderboardIds = eventAResult.data.map((item) => item.leaderboardId).sort();
      const eventBLeaderboardIds = eventBResult.data.map((item) => item.leaderboardId).sort();

      expect(eventALeaderboardIds).toEqual([eventALb1.data.leaderboardId, eventALb2.data.leaderboardId].sort());
      expect(eventAResult.data.every((item) => item.eventId === eventA)).toBe(true);

      expect(eventBLeaderboardIds).toEqual([eventBLb1.data.leaderboardId]);
      expect(eventBResult.data.every((item) => item.eventId === eventB)).toBe(true);

      // eventB's query must not contain any of eventA's leaderboards, and vice versa.
      expect(eventBLeaderboardIds).not.toContain(eventALb1.data.leaderboardId);
      expect(eventBLeaderboardIds).not.toContain(eventALb2.data.leaderboardId);
      expect(eventALeaderboardIds).not.toContain(eventBLb1.data.leaderboardId);
    });

    it('should not return standalone virtual leaderboards from the sparse GSI', async () => {
      const eventId = generateResourceId();

      await LeaderboardsEntity.create({
        ...TEST_LEADERBOARD_ITEM,
        leaderboardId: generateResourceId(),
        name: generateResourceId(),
      }).go();

      const { data } = await LeaderboardsEntity.query.byEventId({ eventId }).go();

      expect(data).toHaveLength(0);
    });
  });
});
