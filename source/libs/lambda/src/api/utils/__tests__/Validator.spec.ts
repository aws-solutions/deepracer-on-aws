// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_MODEL_ITEM, TEST_TRAINING_ITEM, modelDao } from '@deepracer-indy/database';
import {
  ActionSpace,
  Sensors,
  ModelDefinition,
  BadRequestError,
  ModelStatus,
  CameraSensor,
  LidarSensor,
} from '@deepracer-indy/typescript-server-client';

import { validator } from '../Validator.js';

describe('Validator', () => {
  const mockModelDefinition: ModelDefinition = {
    name: TEST_MODEL_ITEM.name,
    carCustomization: TEST_MODEL_ITEM.carCustomization,
    description: TEST_MODEL_ITEM.description,
    metadata: TEST_MODEL_ITEM.metadata,
    trainingConfig: {
      maxTimeInMinutes: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes,
      raceType: TEST_TRAINING_ITEM.raceType,
      trackConfig: TEST_TRAINING_ITEM.trackConfig,
    },
  };

  describe('validateCloneModel', () => {
    it('should throw BadRequestError when pre-trained model not found', async () => {
      vi.spyOn(modelDao, 'get').mockResolvedValueOnce(null);

      await expect(
        validator.validateCloneModel(TEST_MODEL_ITEM.profileId, TEST_MODEL_ITEM.modelId, mockModelDefinition),
      ).rejects.toThrow(BadRequestError);

      expect(modelDao.get).toHaveBeenCalledWith({
        profileId: TEST_MODEL_ITEM.profileId,
        modelId: TEST_MODEL_ITEM.modelId,
      });
    });

    it('should throw BadRequestError when pre-trained model is not ready', async () => {
      vi.spyOn(modelDao, 'get').mockResolvedValueOnce({ ...TEST_MODEL_ITEM, status: ModelStatus.EVALUATING });

      await expect(
        validator.validateCloneModel(TEST_MODEL_ITEM.profileId, TEST_MODEL_ITEM.modelId, mockModelDefinition),
      ).rejects.toThrow(BadRequestError);

      expect(modelDao.get).toHaveBeenCalledWith({
        profileId: TEST_MODEL_ITEM.profileId,
        modelId: TEST_MODEL_ITEM.modelId,
      });
    });

    it('should validate successfully when all conditions are met', async () => {
      vi.spyOn(modelDao, 'get').mockResolvedValueOnce({ ...TEST_MODEL_ITEM, status: ModelStatus.READY });
      vi.spyOn(validator, 'validateCloneSensors').mockReturnValueOnce();
      vi.spyOn(validator, 'validateCloneActionSpace').mockReturnValueOnce();

      await expect(
        validator.validateCloneModel(TEST_MODEL_ITEM.profileId, TEST_MODEL_ITEM.modelId, mockModelDefinition),
      ).resolves.not.toThrow();

      expect(modelDao.get).toHaveBeenCalledWith({
        profileId: TEST_MODEL_ITEM.profileId,
        modelId: TEST_MODEL_ITEM.modelId,
      });
      expect(validator.validateCloneActionSpace).toHaveBeenCalledWith(
        mockModelDefinition.metadata.actionSpace,
        TEST_MODEL_ITEM.metadata.actionSpace,
      );
      expect(validator.validateCloneSensors).toHaveBeenCalledWith(
        mockModelDefinition.metadata.sensors,
        TEST_MODEL_ITEM.metadata.sensors,
      );
    });
  });

  describe('validateCloneActionSpace', () => {
    const mockContinuousActionSpace = {
      continous: {},
    } as ActionSpace;
    const mockDiscreteActionSpaceLength1 = { discrete: [{}] } as ActionSpace;
    const mockDiscreteActionSpaceLength2 = { discrete: [{}, {}] } as ActionSpace;

    it('should throw BadRequestError when action space types mismatch', () => {
      expect(() =>
        validator.validateCloneActionSpace(mockContinuousActionSpace, mockDiscreteActionSpaceLength1),
      ).toThrow(BadRequestError);
    });

    it('should throw BadRequestError when discrete action counts differ', () => {
      expect(() =>
        validator.validateCloneActionSpace(mockDiscreteActionSpaceLength1, mockDiscreteActionSpaceLength2),
      ).toThrow(BadRequestError);
    });

    it('should validate successfully when action spaces are compatible', () => {
      expect(() =>
        validator.validateCloneActionSpace(mockContinuousActionSpace, mockContinuousActionSpace),
      ).not.toThrow();
      expect(() =>
        validator.validateCloneActionSpace(mockDiscreteActionSpaceLength1, mockDiscreteActionSpaceLength1),
      ).not.toThrow();
    });
  });

  describe('validateCloneSensors', () => {
    const mockSensors1: Sensors = { camera: CameraSensor.FRONT_FACING_CAMERA };
    const mockSensors2: Sensors = { camera: CameraSensor.FRONT_FACING_CAMERA, lidar: LidarSensor.SECTOR_LIDAR };
    const mockSensors3: Sensors = { lidar: LidarSensor.SECTOR_LIDAR };
    const mockSensors4: Sensors = { camera: CameraSensor.LEFT_CAMERA, lidar: LidarSensor.DISCRETIZED_SECTOR_LIDAR };

    it('should throw BadRequestError when camera sensors mismatch', () => {
      expect(() => validator.validateCloneSensors(mockSensors1, mockSensors3)).toThrow(BadRequestError);
      expect(() => validator.validateCloneSensors(mockSensors2, mockSensors3)).toThrow(BadRequestError);
      expect(() => validator.validateCloneSensors(mockSensors1, mockSensors4)).toThrow(BadRequestError);
    });

    it('should throw BadRequestError when lidar sensors mismatch', () => {
      expect(() => validator.validateCloneSensors(mockSensors1, mockSensors2)).toThrow(BadRequestError);
      expect(() => validator.validateCloneSensors(mockSensors1, mockSensors3)).toThrow(BadRequestError);
      expect(() => validator.validateCloneSensors(mockSensors2, mockSensors4)).toThrow(BadRequestError);
    });

    it('should validate successfully when sensors match', () => {
      expect(() => validator.validateCloneSensors(mockSensors1, mockSensors1)).not.toThrow();
      expect(() => validator.validateCloneSensors(mockSensors2, mockSensors2)).not.toThrow();
      expect(() => validator.validateCloneSensors(mockSensors3, mockSensors3)).not.toThrow();
      expect(() => validator.validateCloneSensors(mockSensors4, mockSensors4)).not.toThrow();
    });
  });
});
