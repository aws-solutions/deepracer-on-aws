// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_CURSOR, TEST_EVALUATION_ITEM, TEST_EVALUATION_ITEMS } from '../../constants/testConstants.js';
import { EvaluationsEntity } from '../../entities/EvaluationsEntity.js';
import { evaluationDao } from '../EvaluationDao.js';

vi.mock('#entities/EvaluationsEntity.js', () => ({
  EvaluationsEntity: {
    query: {
      byModelId: vi.fn(),
    },
  },
}));

describe('EvaluationDao', () => {
  describe('getStoppableEvaluation()', () => {
    it('should return a stoppable evaluation if found', async () => {
      vi.mocked(EvaluationsEntity.query.byModelId).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: vi.fn(),
        params: vi.fn(),
        where: vi.fn(() => ({
          go: vi.fn().mockResolvedValue({ data: [TEST_EVALUATION_ITEM] }),
          params: vi.fn(),
          where: vi.fn(),
        })),
      });

      const result = await evaluationDao.getStoppableEvaluation(TEST_EVALUATION_ITEM.modelId);

      expect(result).toEqual(TEST_EVALUATION_ITEM);
      expect(EvaluationsEntity.query.byModelId).toHaveBeenCalledWith({ modelId: TEST_EVALUATION_ITEM.modelId });
    });

    it('should return null if no stoppable evaluation is found', async () => {
      vi.mocked(EvaluationsEntity.query.byModelId).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: vi.fn(),
        params: vi.fn(),
        where: vi.fn(() => ({
          go: vi.fn().mockResolvedValue({ data: [] }),
          params: vi.fn(),
          where: vi.fn(),
        })),
      });

      const result = await evaluationDao.getStoppableEvaluation(TEST_EVALUATION_ITEM.modelId);

      expect(result).toBeNull();
      expect(EvaluationsEntity.query.byModelId).toHaveBeenCalledWith({ modelId: TEST_EVALUATION_ITEM.modelId });
    });
  });

  describe('list()', () => {
    it('should correctly use EvaluationsEntity to list evaluations', async () => {
      const testParams: Parameters<(typeof evaluationDao)['list']>[0] = {
        cursor: TEST_CURSOR,
        maxResults: 10,
        modelId: TEST_EVALUATION_ITEM.profileId,
      };

      const mockGo = vi.fn().mockResolvedValue({ cursor: TEST_CURSOR, data: TEST_EVALUATION_ITEMS });

      vi.mocked(EvaluationsEntity.query.byModelId).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: mockGo,
        params: vi.fn(),
        where: vi.fn(),
      });

      const result = await evaluationDao.list(testParams);

      expect(result.data).toEqual(TEST_EVALUATION_ITEMS);
      expect(result.cursor).toEqual(TEST_CURSOR);
      expect(EvaluationsEntity.query.byModelId).toHaveBeenCalledWith({
        modelId: testParams.modelId,
      });
      expect(mockGo).toHaveBeenCalledWith({
        cursor: testParams.cursor,
        limit: testParams.maxResults,
      });
    });
  });
});
