// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { vi } from 'vitest';

import { TEST_PROFILE_ID_1, TEST_PROFILE_ID_2, TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { ProfilesEntity } from '../../../entities/ProfilesEntity.js';
import { MetricsProfileDao } from '../MetricsProfileDao.js';

vi.mock('@deepracer-indy/config');

const mockConfig = vi.mocked(deepRacerIndyAppConfig);

const mockProfilesEntity = vi.hoisted(() => ({
  query: {
    bySortKey: vi.fn(),
  },
}));

vi.mock('#entities/ProfilesEntity.js', () => ({
  ProfilesEntity: mockProfilesEntity,
}));

describe('MetricsProfileDao', () => {
  let metricsProfileDao: MetricsProfileDao;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.dynamoDB = {
      tableName: `${TEST_NAMESPACE}-DeepRacerIndy.Main` as const,
      resourceIdLength: 15,
    };

    metricsProfileDao = new MetricsProfileDao(ProfilesEntity);
  });

  describe('listProfileIds', () => {
    it('should return profile IDs with pagination', async () => {
      const mockElectroResponse = {
        data: [{ profileId: TEST_PROFILE_ID_1 }, { profileId: TEST_PROFILE_ID_2 }],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await metricsProfileDao.listProfileIds({ maxResults: 25 });

      expect(result.data).toEqual([TEST_PROFILE_ID_1, TEST_PROFILE_ID_2]);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['profileId'],
        limit: 25,
        cursor: undefined,
      });
    });

    it('should handle cursor pagination', async () => {
      const inputCursor = { pk: 'profiles', sk: 'profile_abc' };
      const inputCursorString = Buffer.from(JSON.stringify(inputCursor)).toString('base64');
      const outputCursor = { pk: 'profiles', sk: 'profile_xyz' };
      const expectedCursorString = Buffer.from(JSON.stringify(outputCursor)).toString('base64');

      const mockElectroResponse = {
        data: [{ profileId: TEST_PROFILE_ID_1 }],
        cursor: outputCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await metricsProfileDao.listProfileIds({
        cursor: inputCursorString,
        maxResults: 10,
      });

      expect(result.data).toEqual([TEST_PROFILE_ID_1]);
      expect(result.cursor).toBe(expectedCursorString);
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['profileId'],
        limit: 10,
        cursor: inputCursor,
      });
    });

    it('should handle empty results', async () => {
      const mockElectroResponse = {
        data: [],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await metricsProfileDao.listProfileIds();

      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });
  });

  describe('count', () => {
    it('should count all profiles across multiple pages', async () => {
      const page1Cursor = { pk: 'profiles', sk: 'profile_page1' };

      // Mock first page
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ profileId: TEST_PROFILE_ID_1 }, { profileId: TEST_PROFILE_ID_2 }],
        cursor: page1Cursor,
      });

      // Mock second page (final page)
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ profileId: 'profile-3' }],
        cursor: null,
      });

      mockProfilesEntity.query.bySortKey.mockReturnValueOnce({ go: mockGo1 }).mockReturnValueOnce({ go: mockGo2 });

      const result = await metricsProfileDao.count();

      expect(result).toBe(3);
      expect(mockProfilesEntity.query.bySortKey).toHaveBeenCalledTimes(2);
    });

    it('should handle single page results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [{ profileId: TEST_PROFILE_ID_1 }],
        cursor: null,
      });

      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await metricsProfileDao.count();

      expect(result).toBe(1);
      expect(mockProfilesEntity.query.bySortKey).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await metricsProfileDao.count();

      expect(result).toBe(0);
    });
  });
});
