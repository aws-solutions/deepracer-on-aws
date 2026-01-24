// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { vi } from 'vitest';

import {
  TEST_MODEL_ID_1,
  TEST_TRAINING_JOB_ID_1,
  TEST_TRAINING_JOB_ID_2,
  TEST_NAMESPACE,
} from '../../../constants/testConstants.js';
import { TrainingsEntity } from '../../../entities/TrainingsEntity.js';
import { MetricsTrainingDao } from '../MetricsTrainingDao.js';

vi.mock('@deepracer-indy/config');

const mockConfig = vi.mocked(deepRacerIndyAppConfig);

const mockTrainingsEntity = vi.hoisted(() => ({
  query: {
    byModelId: vi.fn(),
  },
}));

vi.mock('#entities/TrainingsEntity.js', () => ({
  TrainingsEntity: mockTrainingsEntity,
}));

describe('MetricsTrainingDao', () => {
  let metricsTrainingDao: MetricsTrainingDao;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.dynamoDB = {
      tableName: `${TEST_NAMESPACE}-DeepRacerIndy.Main` as const,
      resourceIdLength: 15,
    };

    metricsTrainingDao = new MetricsTrainingDao(TrainingsEntity);
  });

  describe('list', () => {
    it('should return training jobs for a model with pagination', async () => {
      const mockElectroResponse = {
        data: [
          { trainingJobId: TEST_TRAINING_JOB_ID_1, name: 'training-1', status: 'InProgress' },
          { trainingJobId: TEST_TRAINING_JOB_ID_2, name: 'training-2', status: 'Completed' },
        ],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockTrainingsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsTrainingDao.list({
        modelId: TEST_MODEL_ID_1,
        maxResults: 2,
      });

      expect(result.data).toEqual(mockElectroResponse.data);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        cursor: null,
        limit: 2,
      });
    });

    it('should handle cursor pagination', async () => {
      const inputCursor = 'cursor-string';
      const outputCursor = 'next-cursor-string';

      const mockElectroResponse = {
        data: [{ trainingJobId: TEST_TRAINING_JOB_ID_1, name: 'training-1' }],
        cursor: outputCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockTrainingsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsTrainingDao.list({
        modelId: TEST_MODEL_ID_1,
        cursor: inputCursor,
        maxResults: 10,
      });

      expect(result.data).toEqual(mockElectroResponse.data);
      expect(result.cursor).toBe(outputCursor);
      expect(mockGo).toHaveBeenCalledWith({
        cursor: inputCursor,
        limit: 10,
      });
    });
  });

  describe('listTrainingNames', () => {
    it('should return training names for a model with pagination', async () => {
      const mockElectroResponse = {
        data: [{ name: 'training-job-1' }, { name: 'training-job-2' }],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockTrainingsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsTrainingDao.listTrainingNames({
        modelId: TEST_MODEL_ID_1,
        maxResults: 2,
      });

      expect(result.data).toEqual(['training-job-1', 'training-job-2']);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['name'],
        limit: 2,
        cursor: undefined,
      });
    });

    it('should handle cursor pagination', async () => {
      const inputCursor = { pk: 'training_model', sk: 'training_abc' };
      const inputCursorString = Buffer.from(JSON.stringify(inputCursor)).toString('base64');
      const outputCursor = { pk: 'training_model', sk: 'training_xyz' };
      const expectedCursorString = Buffer.from(JSON.stringify(outputCursor)).toString('base64');

      const mockElectroResponse = {
        data: [{ name: 'training-job-1' }],
        cursor: outputCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockTrainingsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsTrainingDao.listTrainingNames({
        modelId: TEST_MODEL_ID_1,
        cursor: inputCursorString,
        maxResults: 10,
      });

      expect(result.data).toEqual(['training-job-1']);
      expect(result.cursor).toBe(expectedCursorString);
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['name'],
        limit: 10,
        cursor: inputCursor,
      });
    });
  });

  describe('countTrainingJobsByModel', () => {
    it('should count training jobs for a model across multiple pages', async () => {
      const page1Cursor = { pk: 'training_model', sk: 'training_page1' };

      // Mock first page
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ name: 'training-1' }, { name: 'training-2' }],
        cursor: page1Cursor,
      });

      // Mock second page (final page)
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ name: 'training-3' }],
        cursor: null,
      });

      mockTrainingsEntity.query.byModelId.mockReturnValueOnce({ go: mockGo1 }).mockReturnValueOnce({ go: mockGo2 });

      const result = await metricsTrainingDao.countTrainingJobsByModel(TEST_MODEL_ID_1);

      expect(result).toBe(3);
      expect(mockTrainingsEntity.query.byModelId).toHaveBeenCalledTimes(2);
    });

    it('should handle single page results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [{ name: 'training-1' }],
        cursor: null,
      });

      mockTrainingsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsTrainingDao.countTrainingJobsByModel(TEST_MODEL_ID_1);

      expect(result).toBe(1);
    });

    it('should handle empty results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockTrainingsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsTrainingDao.countTrainingJobsByModel(TEST_MODEL_ID_1);

      expect(result).toBe(0);
    });
  });
});
