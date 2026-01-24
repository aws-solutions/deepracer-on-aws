// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { vi } from 'vitest';

import {
  TEST_MODEL_ID_1,
  TEST_MODEL_ID_2,
  TEST_PROFILE_ID_1,
  TEST_PROFILE_ID_2,
  TEST_PROFILE_ID_3,
  TEST_NAMESPACE,
} from '../../../constants/testConstants.js';
import { ModelsEntity } from '../../../entities/ModelsEntity.js';
import { MetricsModelDao } from '../MetricsModelDao.js';
import { metricsProfileDao } from '../MetricsProfileDao.js';

vi.mock('@deepracer-indy/config');
vi.mock('../MetricsProfileDao.js', () => ({
  metricsProfileDao: {
    listProfileIds: vi.fn(),
  },
}));

const mockConfig = vi.mocked(deepRacerIndyAppConfig);

const mockModelsEntity = vi.hoisted(() => ({
  query: {
    byProfileId: vi.fn(),
  },
}));

vi.mock('#entities/ModelsEntity.js', () => ({
  ModelsEntity: mockModelsEntity,
}));

describe('MetricsModelDao', () => {
  let metricsModelDao: MetricsModelDao;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.dynamoDB = {
      tableName: `${TEST_NAMESPACE}-DeepRacerIndy.Main` as const,
      resourceIdLength: 15,
    };

    metricsModelDao = new MetricsModelDao(ModelsEntity);
  });

  describe('listModelIds', () => {
    it('should return model IDs for a profile with pagination', async () => {
      const mockElectroResponse = {
        data: [{ modelId: TEST_MODEL_ID_1 }, { modelId: TEST_MODEL_ID_2 }],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockModelsEntity.query.byProfileId.mockReturnValue({ go: mockGo });

      const result = await metricsModelDao.listModelIds({
        profileId: TEST_PROFILE_ID_1,
        maxResults: 25,
      });

      expect(result.data).toEqual([TEST_MODEL_ID_1, TEST_MODEL_ID_2]);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['modelId'],
        limit: 25,
        cursor: undefined,
      });
    });

    it('should handle cursor pagination', async () => {
      const inputCursor = { pk: 'model_profile', sk: 'model_abc' };
      const inputCursorString = Buffer.from(JSON.stringify(inputCursor)).toString('base64');
      const outputCursor = { pk: 'model_profile', sk: 'model_xyz' };
      const expectedCursorString = Buffer.from(JSON.stringify(outputCursor)).toString('base64');

      const mockElectroResponse = {
        data: [{ modelId: TEST_MODEL_ID_1 }],
        cursor: outputCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockModelsEntity.query.byProfileId.mockReturnValue({ go: mockGo });

      const result = await metricsModelDao.listModelIds({
        profileId: TEST_PROFILE_ID_1,
        cursor: inputCursorString,
        maxResults: 10,
      });

      expect(result.data).toEqual([TEST_MODEL_ID_1]);
      expect(result.cursor).toBe(expectedCursorString);
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['modelId'],
        limit: 10,
        cursor: inputCursor,
      });
    });
  });

  describe('countByProfile', () => {
    it('should count models for a profile across multiple pages', async () => {
      const page1Cursor = { pk: 'model_profile', sk: 'model_page1' };

      // Mock first page
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ modelId: TEST_MODEL_ID_1 }, { modelId: TEST_MODEL_ID_2 }],
        cursor: page1Cursor,
      });

      // Mock second page (final page)
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-3' }],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId.mockReturnValueOnce({ go: mockGo1 }).mockReturnValueOnce({ go: mockGo2 });

      const result = await metricsModelDao.countByProfile(TEST_PROFILE_ID_1);

      expect(result).toBe(3);
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledTimes(2);
    });

    it('should handle single page results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [{ modelId: TEST_MODEL_ID_1 }],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId.mockReturnValue({ go: mockGo });

      const result = await metricsModelDao.countByProfile(TEST_PROFILE_ID_1);

      expect(result).toBe(1);
    });

    it('should handle empty results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId.mockReturnValue({ go: mockGo });

      const result = await metricsModelDao.countByProfile(TEST_PROFILE_ID_1);

      expect(result).toBe(0);
    });
  });

  describe('count', () => {
    it('should count total models across all profiles', async () => {
      const mockProfileIds = [TEST_PROFILE_ID_1, TEST_PROFILE_ID_2, TEST_PROFILE_ID_3];

      // Mock profile listing
      vi.mocked(metricsProfileDao.listProfileIds).mockResolvedValue({
        data: mockProfileIds,
        cursor: null,
      });

      // Mock model counts for each profile
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-1' }, { modelId: 'model-2' }],
        cursor: null,
      });
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-3' }],
        cursor: null,
      });
      const mockGo3 = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId
        .mockReturnValueOnce({ go: mockGo1 })
        .mockReturnValueOnce({ go: mockGo2 })
        .mockReturnValueOnce({ go: mockGo3 });

      const result = await metricsModelDao.count();

      expect(result).toBe(3); // 2 + 1 + 0 = 3 total models
      expect(metricsProfileDao.listProfileIds).toHaveBeenCalledWith({ cursor: null });
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledTimes(3);
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledWith({ profileId: TEST_PROFILE_ID_1 });
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledWith({ profileId: TEST_PROFILE_ID_2 });
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledWith({ profileId: TEST_PROFILE_ID_3 });
    });

    it('should handle pagination across profiles', async () => {
      const page1Cursor = Buffer.from(JSON.stringify({ pk: 'profile', sk: 'page1' })).toString('base64');

      // Mock profile listing with pagination
      vi.mocked(metricsProfileDao.listProfileIds)
        .mockResolvedValueOnce({
          data: [TEST_PROFILE_ID_1, TEST_PROFILE_ID_2],
          cursor: page1Cursor,
        })
        .mockResolvedValueOnce({
          data: [TEST_PROFILE_ID_3],
          cursor: null,
        });

      // Mock model counts for each profile
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-1' }],
        cursor: null,
      });
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-2' }, { modelId: 'model-3' }],
        cursor: null,
      });
      const mockGo3 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-4' }],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId
        .mockReturnValueOnce({ go: mockGo1 })
        .mockReturnValueOnce({ go: mockGo2 })
        .mockReturnValueOnce({ go: mockGo3 });

      const result = await metricsModelDao.count();

      expect(result).toBe(4); // 1 + 2 + 1 = 4 total models
      expect(metricsProfileDao.listProfileIds).toHaveBeenCalledTimes(2);
      expect(metricsProfileDao.listProfileIds).toHaveBeenNthCalledWith(1, { cursor: null });
      expect(metricsProfileDao.listProfileIds).toHaveBeenNthCalledWith(2, { cursor: page1Cursor });
    });

    it('should handle profiles with paginated models', async () => {
      // Mock profile listing
      vi.mocked(metricsProfileDao.listProfileIds).mockResolvedValue({
        data: [TEST_PROFILE_ID_1],
        cursor: null,
      });

      // Mock model count for profile with pagination
      const modelCursor = { pk: 'model_profile', sk: 'model_page1' };
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-1' }, { modelId: 'model-2' }],
        cursor: modelCursor,
      });
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ modelId: 'model-3' }],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId.mockReturnValueOnce({ go: mockGo1 }).mockReturnValueOnce({ go: mockGo2 });

      const result = await metricsModelDao.count();

      expect(result).toBe(3); // 2 + 1 = 3 total models
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no profiles exist', async () => {
      // Mock empty profile listing
      vi.mocked(metricsProfileDao.listProfileIds).mockResolvedValue({
        data: [],
        cursor: null,
      });

      const result = await metricsModelDao.count();

      expect(result).toBe(0);
      expect(metricsProfileDao.listProfileIds).toHaveBeenCalledWith({ cursor: null });
      expect(mockModelsEntity.query.byProfileId).not.toHaveBeenCalled();
    });

    it('should return 0 when profiles exist but have no models', async () => {
      // Mock profile listing
      vi.mocked(metricsProfileDao.listProfileIds).mockResolvedValue({
        data: [TEST_PROFILE_ID_1, TEST_PROFILE_ID_2],
        cursor: null,
      });

      // Mock empty model counts for both profiles
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockModelsEntity.query.byProfileId.mockReturnValue({ go: mockGo });

      const result = await metricsModelDao.count();

      expect(result).toBe(0);
      expect(mockModelsEntity.query.byProfileId).toHaveBeenCalledTimes(2);
    });
  });
});
