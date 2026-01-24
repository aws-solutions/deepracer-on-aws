// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_TRAINING_ITEM } from '../../constants/testConstants.js';
import { TrainingsEntity } from '../../entities/TrainingsEntity.js';
import { trainingDao } from '../TrainingDao.js';

vi.mock('#entities/TrainingsEntity.js', () => ({
  TrainingsEntity: {
    query: {
      byModelId: vi.fn(),
    },
  },
}));

describe('TrainingDao', () => {
  describe('getStoppableTraining()', () => {
    it('should return a stoppable training if found', async () => {
      vi.mocked(TrainingsEntity.query.byModelId).mockReturnValue({
        go: vi.fn(),
        params: vi.fn(),
        where: vi.fn(() => ({
          go: vi.fn().mockResolvedValue({ data: [TEST_TRAINING_ITEM] }),
          params: vi.fn(),
          where: vi.fn(),
        })),
      });

      const result = await trainingDao.getStoppableTraining(TEST_TRAINING_ITEM.modelId);

      expect(result).toEqual(TEST_TRAINING_ITEM);
      expect(TrainingsEntity.query.byModelId).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId });
    });

    it('should return null if no stoppable training is found', async () => {
      vi.mocked(TrainingsEntity.query.byModelId).mockReturnValue({
        go: vi.fn(),
        params: vi.fn(),
        where: vi.fn(() => ({
          go: vi.fn().mockResolvedValue({ data: [] }),
          params: vi.fn(),
          where: vi.fn(),
        })),
      });

      const result = await trainingDao.getStoppableTraining(TEST_TRAINING_ITEM.modelId);

      expect(result).toBeNull();
      expect(TrainingsEntity.query.byModelId).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId });
    });
  });
});
