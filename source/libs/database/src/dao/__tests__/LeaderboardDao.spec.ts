// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';

import {
  LiveEventStatus,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { RESOURCE_ID_REGEX } from '../../constants/regex.js';
import type { LeaderboardItem, LeaderboardsEntity } from '../../entities/LeaderboardsEntity.js';
import { leaderboardDao } from '../LeaderboardDao.js';

vi.mock('#constants/defaults.js', () => ({
  DEFAULT_MAX_QUERY_RESULTS: 1,
}));

const createLeaderboardParams = {
  [DynamoDBItemAttribute.TRACK_CONFIG]: {
    [DynamoDBItemAttribute.TRACK_DIRECTION]: TrackDirection.COUNTER_CLOCKWISE,
    [DynamoDBItemAttribute.TRACK_ID]: TrackId.ACE_SPEEDWAY,
  },
  [DynamoDBItemAttribute.RACE_TYPE]: RaceType.TIME_TRIAL,
  [DynamoDBItemAttribute.CLOSE_TIME]: new Date().toISOString(),
  [DynamoDBItemAttribute.OPEN_TIME]: new Date().toISOString(),
  [DynamoDBItemAttribute.RESETTING_BEHAVIOR_CONFIG]: {
    continuousLap: false,
  },
  [DynamoDBItemAttribute.SUBMISSION_TERMINATION_CONDITIONS]: {
    [DynamoDBItemAttribute.MAX_LAPS]: 5,
  },
  [DynamoDBItemAttribute.TIMING_METHOD]: TimingMethod.AVG_LAP_TIME,
  [DynamoDBItemAttribute.MAX_SUBMISSIONS_PER_USER]: 5,
} satisfies Omit<Parameters<LeaderboardsEntity['create']>[0], 'name'>;

describe('LeaderboardDao', () => {
  describe('list()', () => {
    it('should return items up to maxResults and provide cursor for resuming query', async () => {
      const createLeaderboardParamList = Array.from({ length: DEFAULT_MAX_QUERY_RESULTS + 1 }, () => ({
        name: randomUUID(),
        ...createLeaderboardParams,
      }));

      await Promise.all(createLeaderboardParamList.map((params) => leaderboardDao.create(params)));

      const defaultMaxResults = await leaderboardDao.list({});
      const restResults = await leaderboardDao.list({
        cursor: defaultMaxResults.cursor,
      });
      const allResults = [...defaultMaxResults.data, ...restResults.data];

      expect(defaultMaxResults.data).toHaveLength(DEFAULT_MAX_QUERY_RESULTS);
      expect(restResults.data).toHaveLength(createLeaderboardParamList.length - defaultMaxResults.data.length);
      expect(validateLeaderboards(allResults, createLeaderboardParamList)).toBe(true);
    });
  });

  describe('listOpen()', () => {
    it('should list only open leaderboards', async () => {
      const createOpenLeaderboardParamList = Array.from({ length: 2 }, () => ({
        ...createLeaderboardParams,
        name: randomUUID(),
        openTime: new Date(Date.now() - 50_000).toISOString(),
        closeTime: new Date(Date.now() + 5_000).toISOString(),
      }));
      const createClosedLeaderboardParams = {
        ...createLeaderboardParams,
        name: randomUUID(),
        openTime: new Date(Date.now() - 50_000).toISOString(),
        closeTime: new Date(Date.now() - 5_000).toISOString(),
      };

      await Promise.all([
        createOpenLeaderboardParamList.map((params) => leaderboardDao.create(params)),
        leaderboardDao.create(createClosedLeaderboardParams),
      ]);

      const { data: openLeaderboardResults } = await leaderboardDao.listOpen({ maxResults: 10 });

      expect(openLeaderboardResults).toHaveLength(createOpenLeaderboardParamList.length);
      expect(validateLeaderboards(openLeaderboardResults, createOpenLeaderboardParamList)).toBe(true);
    });
  });

  describe('clearExecutionLock()', () => {
    it('should clear currentExecutionArn unconditionally when no expectedArn', async () => {
      const leaderboard = await leaderboardDao.create({
        name: randomUUID(),
        ...createLeaderboardParams,
      });

      await leaderboardDao.partialUpdate(
        { leaderboardId: leaderboard.leaderboardId },
        { currentExecutionArn: 'arn:aws:states:us-east-1:123:execution:test' },
      );

      await leaderboardDao.clearExecutionLock(leaderboard.leaderboardId);

      const updated = await leaderboardDao.load({ leaderboardId: leaderboard.leaderboardId });
      expect(updated.currentExecutionArn).toBe('');
    });

    it('should clear when expectedArn matches', async () => {
      const arn = 'arn:aws:states:us-east-1:123:execution:matching';
      const leaderboard = await leaderboardDao.create({
        name: randomUUID(),
        ...createLeaderboardParams,
      });

      await leaderboardDao.partialUpdate({ leaderboardId: leaderboard.leaderboardId }, { currentExecutionArn: arn });

      await leaderboardDao.clearExecutionLock(leaderboard.leaderboardId, arn);

      const updated = await leaderboardDao.load({ leaderboardId: leaderboard.leaderboardId });
      expect(updated.currentExecutionArn).toBe('');
    });

    it('should throw when expectedArn does not match', async () => {
      const leaderboard = await leaderboardDao.create({
        name: randomUUID(),
        ...createLeaderboardParams,
      });

      await leaderboardDao.partialUpdate(
        { leaderboardId: leaderboard.leaderboardId },
        { currentExecutionArn: 'arn:aws:states:us-east-1:123:execution:current' },
      );

      await expect(
        leaderboardDao.clearExecutionLock(
          leaderboard.leaderboardId,
          'arn:aws:states:us-east-1:123:execution:different',
        ),
      ).rejects.toThrow();
    });
  });

  describe('acquireExecutionLock()', () => {
    it('should set execution lock when currentExecutionArn is empty', async () => {
      const leaderboard = await leaderboardDao.create({
        name: randomUUID(),
        ...createLeaderboardParams,
      });

      const arn = 'arn:aws:states:us-east-1:123:execution:new';
      await leaderboardDao.acquireExecutionLock(leaderboard.leaderboardId, arn);

      const updated = await leaderboardDao.load({ leaderboardId: leaderboard.leaderboardId });
      expect(updated.currentExecutionArn).toBe(arn);
      expect(updated.liveEventStatus).toBe(LiveEventStatus.IN_PROGRESS);
    });

    it('should set execution lock when currentExecutionArn is not set', async () => {
      const leaderboard = await leaderboardDao.create({
        name: randomUUID(),
        ...createLeaderboardParams,
      });

      const arn = 'arn:aws:states:us-east-1:123:execution:fresh';
      await leaderboardDao.acquireExecutionLock(leaderboard.leaderboardId, arn);

      const updated = await leaderboardDao.load({ leaderboardId: leaderboard.leaderboardId });
      expect(updated.currentExecutionArn).toBe(arn);
    });

    it('should throw when another execution already holds the lock', async () => {
      const leaderboard = await leaderboardDao.create({
        name: randomUUID(),
        ...createLeaderboardParams,
      });

      await leaderboardDao.partialUpdate(
        { leaderboardId: leaderboard.leaderboardId },
        { currentExecutionArn: 'arn:aws:states:us-east-1:123:execution:existing' },
      );

      await expect(
        leaderboardDao.acquireExecutionLock(leaderboard.leaderboardId, 'arn:aws:states:us-east-1:123:execution:new'),
      ).rejects.toThrow();
    });
  });
});

function validateLeaderboards(
  leaderboards: LeaderboardItem[],
  createLeaderboardParamList: Parameters<LeaderboardsEntity['create']>[0][],
) {
  for (const params of createLeaderboardParamList) {
    expect(leaderboards).toContainEqual({
      ...params,
      [DynamoDBItemAttribute.LEADERBOARD_ID]: expect.stringMatching(RESOURCE_ID_REGEX),
      [DynamoDBItemAttribute.MINIMUM_LAPS]: 0,
      [DynamoDBItemAttribute.PARTICIPANT_COUNT]: 0,
      [DynamoDBItemAttribute.MAX_SUBMISSIONS_PER_USER]: 5,
      [DynamoDBItemAttribute.AUTO_LAUNCH_ENABLED]: false,
      [DynamoDBItemAttribute.IS_LIVE]: false,
      [DynamoDBItemAttribute.SUBMISSION_PERIOD_OPEN]: false,
      [DynamoDBItemAttribute.CREATED_AT]: expect.any(String),
      [DynamoDBItemAttribute.UPDATED_AT]: expect.any(String),
    });
  }
  return true;
}
