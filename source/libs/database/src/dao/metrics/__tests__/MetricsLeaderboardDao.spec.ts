// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { vi } from 'vitest';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../../constants/defaults.js';
import { TEST_LEADERBOARD_ID, TEST_LEADERBOARD_ID_2, TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { LeaderboardsEntity } from '../../../entities/LeaderboardsEntity.js';
import { MetricsLeaderboardDao } from '../MetricsLeaderboardDao.js';

vi.mock('@deepracer-indy/config');

const mockConfig = vi.mocked(deepRacerIndyAppConfig);

const mockLeaderboardsEntity = vi.hoisted(() => ({
  query: {
    sortedByCloseTime: vi.fn(),
  },
}));

vi.mock('#entities/LeaderboardsEntity.js', () => ({
  LeaderboardsEntity: mockLeaderboardsEntity,
}));

describe('MetricsLeaderboardDao', () => {
  let metricsLeaderboardDao: MetricsLeaderboardDao;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.dynamoDB = {
      tableName: `${TEST_NAMESPACE}-DeepRacerIndy.Main` as const,
      resourceIdLength: 15,
    };

    metricsLeaderboardDao = new MetricsLeaderboardDao(LeaderboardsEntity);
  });

  describe('listIdsForMetrics', () => {
    it('should return leaderboard IDs with pagination', async () => {
      const mockElectroResponse = {
        data: [{ leaderboardId: TEST_LEADERBOARD_ID }, { leaderboardId: TEST_LEADERBOARD_ID_2 }],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockLeaderboardsEntity.query.sortedByCloseTime.mockReturnValue({ go: mockGo });

      const result = await metricsLeaderboardDao.listIdsForMetrics({ maxResults: 2 });

      expect(result.data).toEqual([TEST_LEADERBOARD_ID, TEST_LEADERBOARD_ID_2]);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['leaderboardId'],
        cursor: undefined,
        limit: 2,
      });
    });

    it('should handle cursor pagination', async () => {
      const inputCursor = { pk: 'leaderboard', sk: 'leaderboard_abc' };
      const inputCursorString = Buffer.from(JSON.stringify(inputCursor)).toString('base64');
      const outputCursor = { pk: 'leaderboard', sk: 'leaderboard_xyz' };
      const expectedCursorString = Buffer.from(JSON.stringify(outputCursor)).toString('base64');

      const mockElectroResponse = {
        data: [{ leaderboardId: TEST_LEADERBOARD_ID }],
        cursor: outputCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockLeaderboardsEntity.query.sortedByCloseTime.mockReturnValue({ go: mockGo });

      const result = await metricsLeaderboardDao.listIdsForMetrics({
        cursor: inputCursorString,
        maxResults: 10,
      });

      expect(result.data).toEqual([TEST_LEADERBOARD_ID]);
      expect(result.cursor).toBe(expectedCursorString);
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['leaderboardId'],
        limit: 10,
        cursor: inputCursor,
      });
    });

    it('should use default parameters when none provided', async () => {
      const mockElectroResponse = {
        data: [{ leaderboardId: TEST_LEADERBOARD_ID }],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockLeaderboardsEntity.query.sortedByCloseTime.mockReturnValue({ go: mockGo });

      const result = await metricsLeaderboardDao.listIdsForMetrics();

      expect(result.data).toEqual([TEST_LEADERBOARD_ID]);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['leaderboardId'],
        cursor: undefined,
        limit: DEFAULT_MAX_QUERY_RESULTS,
      });
    });
  });

  describe('count', () => {
    it('should count leaderboards across multiple pages', async () => {
      const page1Cursor = { pk: 'leaderboard', sk: 'leaderboard_page1' };

      // Mock first page
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ leaderboardId: TEST_LEADERBOARD_ID }, { leaderboardId: TEST_LEADERBOARD_ID_2 }],
        cursor: page1Cursor,
      });

      // Mock second page (final page)
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ leaderboardId: 'leaderboard_3' }],
        cursor: null,
      });

      mockLeaderboardsEntity.query.sortedByCloseTime
        .mockReturnValueOnce({ go: mockGo1 })
        .mockReturnValueOnce({ go: mockGo2 });

      const result = await metricsLeaderboardDao.count();

      expect(result).toBe(3);
      expect(mockLeaderboardsEntity.query.sortedByCloseTime).toHaveBeenCalledTimes(2);
    });

    it('should handle single page results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [{ leaderboardId: TEST_LEADERBOARD_ID }],
        cursor: null,
      });

      mockLeaderboardsEntity.query.sortedByCloseTime.mockReturnValue({ go: mockGo });

      const result = await metricsLeaderboardDao.count();

      expect(result).toBe(1);
    });

    it('should handle empty results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockLeaderboardsEntity.query.sortedByCloseTime.mockReturnValue({ go: mockGo });

      const result = await metricsLeaderboardDao.count();

      expect(result).toBe(0);
    });
  });
});
