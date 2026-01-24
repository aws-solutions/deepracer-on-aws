// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { vi } from 'vitest';

import {
  TEST_EVALUATION_ID_1,
  TEST_EVALUATION_ID_2,
  TEST_MODEL_ID_1,
  TEST_NAMESPACE,
} from '../../../constants/testConstants.js';
import { EvaluationsEntity } from '../../../entities/EvaluationsEntity.js';
import { encodeCursor } from '../../../utils/cursorUtils.js';
import { MetricsEvaluationDao } from '../MetricsEvaluationDao.js';

vi.mock('@deepracer-indy/config');

const mockConfig = vi.mocked(deepRacerIndyAppConfig);

const mockEvaluationsEntity = vi.hoisted(() => ({
  query: {
    byModelId: vi.fn(),
  },
}));

vi.mock('#entities/EvaluationsEntity.js', () => ({
  EvaluationsEntity: mockEvaluationsEntity,
}));

describe('MetricsEvaluationDao', () => {
  let metricsEvaluationDao: MetricsEvaluationDao;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.dynamoDB = {
      tableName: `${TEST_NAMESPACE}-DeepRacerIndy.Main` as const,
      resourceIdLength: 15,
    };

    metricsEvaluationDao = new MetricsEvaluationDao(EvaluationsEntity);
  });

  describe('listEvaluationIds', () => {
    it('should return evaluation IDs for a model with pagination', async () => {
      const mockElectroResponse = {
        data: [{ evaluationId: TEST_EVALUATION_ID_1 }, { evaluationId: TEST_EVALUATION_ID_2 }],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockEvaluationsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsEvaluationDao.listEvaluationIds({
        modelId: TEST_MODEL_ID_1,
        maxResults: 2,
      });

      expect(result.data).toEqual([TEST_EVALUATION_ID_1, TEST_EVALUATION_ID_2]);
      expect(result.cursor).toBeNull();
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['evaluationId'],
        cursor: undefined,
        limit: 2,
      });
    });

    it('should handle cursor pagination', async () => {
      const inputCursor = { pk: 'evaluation_model', sk: 'evaluation_abc' };
      const inputCursorString = encodeCursor(inputCursor);
      const outputCursor = { pk: 'evaluation_model', sk: 'evaluation_xyz' };
      const expectedCursorString = encodeCursor(outputCursor);

      const mockElectroResponse = {
        data: [{ evaluationId: TEST_EVALUATION_ID_1 }],
        cursor: outputCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockEvaluationsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsEvaluationDao.listEvaluationIds({
        modelId: TEST_MODEL_ID_1,
        cursor: inputCursorString,
        maxResults: 10,
      });

      expect(result.data).toEqual([TEST_EVALUATION_ID_1]);
      expect(result.cursor).toBe(expectedCursorString);
      expect(mockGo).toHaveBeenCalledWith({
        attributes: ['evaluationId'],
        limit: 10,
        cursor: inputCursor,
      });
    });
  });

  describe('countEvaluationJobsByModel', () => {
    it('should count evaluation jobs for a model across multiple pages', async () => {
      const page1Cursor = { pk: 'evaluation_model', sk: 'evaluation_page1' };

      // Mock first page
      const mockGo1 = vi.fn().mockResolvedValue({
        data: [{ evaluationId: TEST_EVALUATION_ID_1 }, { evaluationId: TEST_EVALUATION_ID_2 }],
        cursor: page1Cursor,
      });

      // Mock second page (final page)
      const mockGo2 = vi.fn().mockResolvedValue({
        data: [{ evaluationId: 'eval_3' }],
        cursor: null,
      });

      mockEvaluationsEntity.query.byModelId.mockReturnValueOnce({ go: mockGo1 }).mockReturnValueOnce({ go: mockGo2 });

      const result = await metricsEvaluationDao.countEvaluationJobsByModel(TEST_MODEL_ID_1);

      expect(result).toBe(3);
      expect(mockEvaluationsEntity.query.byModelId).toHaveBeenCalledTimes(2);
    });

    it('should handle single page results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [{ evaluationId: TEST_EVALUATION_ID_1 }],
        cursor: null,
      });

      mockEvaluationsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsEvaluationDao.countEvaluationJobsByModel(TEST_MODEL_ID_1);

      expect(result).toBe(1);
    });

    it('should handle empty results', async () => {
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });

      mockEvaluationsEntity.query.byModelId.mockReturnValue({ go: mockGo });

      const result = await metricsEvaluationDao.countEvaluationJobsByModel(TEST_MODEL_ID_1);

      expect(result).toBe(0);
    });
  });
});
