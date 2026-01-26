// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { vi } from 'vitest';

import { TEST_MODEL_ID_1, TEST_PROFILE_ID_1 } from '../../../constants/testConstants.js';
import { generateResourceId } from '../../../utils/resourceUtils.js';
import { MetricsDao } from '../metricsDao.js';
import { metricsEvaluationDao } from '../MetricsEvaluationDao.js';
import { metricsLeaderboardDao } from '../MetricsLeaderboardDao.js';
import { metricsModelDao } from '../MetricsModelDao.js';
import { metricsProfileDao } from '../MetricsProfileDao.js';
import { metricsTrainingDao } from '../MetricsTrainingDao.js';

// Mock all the individual DAO modules
vi.mock('../MetricsEvaluationDao.js', () => ({
  metricsEvaluationDao: {
    countEvaluationJobsByModel: vi.fn(),
  },
}));

vi.mock('../MetricsLeaderboardDao.js', () => ({
  metricsLeaderboardDao: {
    count: vi.fn(),
  },
}));

vi.mock('../MetricsModelDao.js', () => ({
  metricsModelDao: {
    listModelIds: vi.fn(),
  },
}));

vi.mock('../MetricsProfileDao.js', () => ({
  metricsProfileDao: {
    listProfileIds: vi.fn(),
  },
}));

vi.mock('../MetricsTrainingDao.js', () => ({
  metricsTrainingDao: {
    countTrainingJobsByModel: vi.fn(),
  },
}));

describe('MetricsDao', () => {
  let metricsDao: MetricsDao;

  beforeEach(() => {
    vi.clearAllMocks();
    metricsDao = new MetricsDao();
  });

  describe('collectSystemMetrics', () => {
    it('should collect all system metrics efficiently', async () => {
      // Mock profile data
      const testProfileId2 = generateResourceId();
      vi.mocked(metricsProfileDao.listProfileIds).mockResolvedValueOnce({
        data: [TEST_PROFILE_ID_1, testProfileId2],
        cursor: null,
      });

      // Mock model data for each profile
      const testModelId2 = generateResourceId();
      const testModelId3 = generateResourceId();
      vi.mocked(metricsModelDao.listModelIds)
        .mockResolvedValueOnce({
          data: [TEST_MODEL_ID_1, testModelId2],
          cursor: null,
        })
        .mockResolvedValueOnce({
          data: [testModelId3],
          cursor: null,
        });

      // Mock training job counts
      vi.mocked(metricsTrainingDao.countTrainingJobsByModel)
        .mockResolvedValueOnce(2) // model_1
        .mockResolvedValueOnce(1) // model_2
        .mockResolvedValueOnce(3); // model_3

      // Mock evaluation job counts
      vi.mocked(metricsEvaluationDao.countEvaluationJobsByModel)
        .mockResolvedValueOnce(1) // model_1
        .mockResolvedValueOnce(2) // model_2
        .mockResolvedValueOnce(0); // model_3

      // Mock leaderboard count
      vi.mocked(metricsLeaderboardDao.count).mockResolvedValue(5);

      const result = await metricsDao.collectSystemMetrics();

      expect(result).toEqual({
        profileCount: 2,
        modelCount: 3,
        trainingJobCount: 6, // 2 + 1 + 3
        evaluationJobCount: 3, // 1 + 2 + 0
        leaderboardCount: 5,
      });

      expect(metricsProfileDao.listProfileIds).toHaveBeenCalledTimes(1);
      expect(metricsModelDao.listModelIds).toHaveBeenCalledTimes(2);
      expect(metricsTrainingDao.countTrainingJobsByModel).toHaveBeenCalledTimes(3);
      expect(metricsEvaluationDao.countEvaluationJobsByModel).toHaveBeenCalledTimes(3);
      expect(metricsLeaderboardDao.count).toHaveBeenCalledTimes(1);
    });

    it('should handle pagination across profiles and models', async () => {
      // Mock profile pagination
      const testProfileId2 = generateResourceId();
      vi.mocked(metricsProfileDao.listProfileIds)
        .mockResolvedValueOnce({
          data: [TEST_PROFILE_ID_1],
          cursor: 'profile_cursor_1',
        })
        .mockResolvedValueOnce({
          data: [testProfileId2],
          cursor: null,
        });

      // Mock model pagination for first profile
      const testModelId2 = generateResourceId();
      const testModelId3 = generateResourceId();
      vi.mocked(metricsModelDao.listModelIds)
        .mockResolvedValueOnce({
          data: [TEST_MODEL_ID_1],
          cursor: 'model_cursor_1',
        })
        .mockResolvedValueOnce({
          data: [testModelId2],
          cursor: null,
        })
        // Mock models for second profile
        .mockResolvedValueOnce({
          data: [testModelId3],
          cursor: null,
        });

      // Mock job counts
      vi.mocked(metricsTrainingDao.countTrainingJobsByModel).mockResolvedValue(1);
      vi.mocked(metricsEvaluationDao.countEvaluationJobsByModel).mockResolvedValue(1);
      vi.mocked(metricsLeaderboardDao.count).mockResolvedValue(2);

      const result = await metricsDao.collectSystemMetrics();

      expect(result).toEqual({
        profileCount: 2,
        modelCount: 3,
        trainingJobCount: 3,
        evaluationJobCount: 3,
        leaderboardCount: 2,
      });

      expect(metricsProfileDao.listProfileIds).toHaveBeenCalledTimes(2);
      expect(metricsModelDao.listModelIds).toHaveBeenCalledTimes(3);
    });
  });

  describe('getModelMetrics', () => {
    it('should get metrics for a specific model', async () => {
      vi.mocked(metricsTrainingDao.countTrainingJobsByModel).mockResolvedValue(5);
      vi.mocked(metricsEvaluationDao.countEvaluationJobsByModel).mockResolvedValue(3);

      const result = await metricsDao.getModelMetrics(TEST_MODEL_ID_1);

      expect(result).toEqual({
        modelId: TEST_MODEL_ID_1,
        trainingJobCount: 5,
        evaluationJobCount: 3,
      });

      expect(metricsTrainingDao.countTrainingJobsByModel).toHaveBeenCalledWith(TEST_MODEL_ID_1);
      expect(metricsEvaluationDao.countEvaluationJobsByModel).toHaveBeenCalledWith(TEST_MODEL_ID_1);
    });
  });

  describe('getProfileMetrics', () => {
    it('should get metrics for a specific profile', async () => {
      // Mock model data for the profile
      const testModelId2 = generateResourceId();
      vi.mocked(metricsModelDao.listModelIds).mockResolvedValueOnce({
        data: [TEST_MODEL_ID_1, testModelId2],
        cursor: null,
      });

      // Mock job counts for each model
      vi.mocked(metricsTrainingDao.countTrainingJobsByModel)
        .mockResolvedValueOnce(3) // model_1
        .mockResolvedValueOnce(2); // model_2

      vi.mocked(metricsEvaluationDao.countEvaluationJobsByModel)
        .mockResolvedValueOnce(1) // model_1
        .mockResolvedValueOnce(4); // model_2

      const result = await metricsDao.getProfileMetrics(TEST_PROFILE_ID_1);

      expect(result).toEqual({
        profileId: TEST_PROFILE_ID_1,
        modelCount: 2,
        trainingJobCount: 5, // 3 + 2
        evaluationJobCount: 5, // 1 + 4
      });

      expect(metricsModelDao.listModelIds).toHaveBeenCalledWith({
        profileId: TEST_PROFILE_ID_1,
        cursor: null,
      });
      expect(metricsTrainingDao.countTrainingJobsByModel).toHaveBeenCalledTimes(2);
      expect(metricsEvaluationDao.countEvaluationJobsByModel).toHaveBeenCalledTimes(2);
    });

    it('should handle pagination when getting profile metrics', async () => {
      // Mock model pagination
      const testModelId2 = generateResourceId();
      vi.mocked(metricsModelDao.listModelIds)
        .mockResolvedValueOnce({
          data: [TEST_MODEL_ID_1],
          cursor: 'model_cursor_1',
        })
        .mockResolvedValueOnce({
          data: [testModelId2],
          cursor: null,
        });

      // Mock job counts
      vi.mocked(metricsTrainingDao.countTrainingJobsByModel).mockResolvedValue(2);
      vi.mocked(metricsEvaluationDao.countEvaluationJobsByModel).mockResolvedValue(1);

      const result = await metricsDao.getProfileMetrics(TEST_PROFILE_ID_1);

      expect(result).toEqual({
        profileId: TEST_PROFILE_ID_1,
        modelCount: 2,
        trainingJobCount: 4, // 2 + 2
        evaluationJobCount: 2, // 1 + 1
      });

      expect(metricsModelDao.listModelIds).toHaveBeenCalledTimes(2);
    });
  });
});
