// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus } from '@deepracer-indy/typescript-server-client';

import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { TEST_TRAINING_ITEM } from '../../constants/testConstants.js';
import { TrainingsEntity } from '../../entities/TrainingsEntity.js';
import { trainingDao } from '../TrainingDao.js';

// vi.hoisted ensures these fn refs exist before the vi.mock factory is executed. The locals are named
// without the `mock` prefix so they do not shadow the destructured bindings above.
const { mockGo, mockWhere, mockRemove, mockSetStatusMessage, mockAdd, mockSetStatus, mockPatch } = vi.hoisted(() => {
  const go = vi.fn();
  const where = vi.fn(() => ({ go }));
  const remove = vi.fn(() => ({ where }));
  const setStatusMessage = vi.fn(() => ({ where }));
  const add = vi.fn(() => ({ remove, set: setStatusMessage }));
  const setStatus = vi.fn(() => ({ add }));
  const patch = vi.fn(() => ({ set: setStatus }));

  return {
    mockGo: go,
    mockWhere: where,
    mockRemove: remove,
    mockSetStatusMessage: setStatusMessage,
    mockAdd: add,
    mockSetStatus: setStatus,
    mockPatch: patch,
  };
});

vi.mock('#entities/TrainingsEntity.js', () => ({
  TrainingsEntity: {
    query: {
      byModelId: vi.fn(),
    },
    patch: mockPatch,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await trainingDao.getStoppableTraining(TEST_TRAINING_ITEM.modelId);

      expect(result).toBeNull();
      expect(TrainingsEntity.query.byModelId).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId });
    });
  });

  describe('transitionStatus()', () => {
    beforeEach(() => {
      mockGo.mockReset();
      mockWhere.mockClear();
      mockRemove.mockClear();
      mockSetStatusMessage.mockClear();
      mockAdd.mockClear();
      mockSetStatus.mockClear();
      mockPatch.mockClear();
    });

    it('should set statusMessage when provided', async () => {
      mockGo.mockResolvedValue({ data: {} });

      await trainingDao.transitionStatus(
        { modelId: TEST_TRAINING_ITEM.modelId },
        { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.QUEUED, statusMessage: 'Retrying after quota' },
      );

      expect(mockPatch).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId });
      expect(mockSetStatus).toHaveBeenCalledWith({ [DynamoDBItemAttribute.STATUS]: JobStatus.QUEUED });
      expect(mockAdd).toHaveBeenCalledWith({ [DynamoDBItemAttribute.VERSION]: 1 });
      // statusMessage is defined → .set() branch
      expect(mockSetStatusMessage).toHaveBeenCalledWith({
        [DynamoDBItemAttribute.STATUS_MESSAGE]: 'Retrying after quota',
      });
      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockGo).toHaveBeenCalled();
    });

    it('should remove statusMessage when statusMessage is undefined', async () => {
      mockGo.mockResolvedValue({ data: {} });

      await trainingDao.transitionStatus(
        { modelId: TEST_TRAINING_ITEM.modelId },
        { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.QUEUED },
      );

      expect(mockPatch).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId });
      expect(mockSetStatus).toHaveBeenCalledWith({ [DynamoDBItemAttribute.STATUS]: JobStatus.QUEUED });
      expect(mockAdd).toHaveBeenCalledWith({ [DynamoDBItemAttribute.VERSION]: 1 });
      // statusMessage is undefined → .remove() branch
      expect(mockRemove).toHaveBeenCalledWith([DynamoDBItemAttribute.STATUS_MESSAGE]);
      expect(mockSetStatusMessage).not.toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockGo).toHaveBeenCalled();
    });

    it('should propagate ConditionalCheckFailedException when the from status no longer matches', async () => {
      const conditionalError = Object.assign(new Error('conditional request failed'), {
        cause: { name: 'ConditionalCheckFailedException' },
      });
      mockGo.mockRejectedValue(conditionalError);

      await expect(
        trainingDao.transitionStatus(
          { modelId: TEST_TRAINING_ITEM.modelId },
          { from: JobStatus.WAITING_FOR_CAPACITY, to: JobStatus.QUEUED },
        ),
      ).rejects.toMatchObject({ cause: { name: 'ConditionalCheckFailedException' } });
    });
  });
});
