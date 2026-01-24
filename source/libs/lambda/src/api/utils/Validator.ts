// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceId, modelDao } from '@deepracer-indy/database';
import {
  ActionSpace,
  Sensors,
  ModelDefinition,
  BadRequestError,
  ModelStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ErrorMessage } from '../constants/errorMessages.js';

class Validator {
  async validateCloneModel(profileId: ResourceId, preTrainedModelId: ResourceId, newModelDefinition: ModelDefinition) {
    const preTrainedModel = await modelDao.get({ profileId, modelId: preTrainedModelId });

    if (!preTrainedModel) {
      logger.error(ErrorMessage.PRE_TRAINED_MODEL_NOT_FOUND, { preTrainedModelId });
      throw new BadRequestError({ message: ErrorMessage.PRE_TRAINED_MODEL_NOT_FOUND });
    }

    if (preTrainedModel.status !== ModelStatus.READY) {
      logger.error(ErrorMessage.PRE_TRAINED_MODEL_NOT_READY, { preTrainedModelId });
      throw new BadRequestError({ message: ErrorMessage.PRE_TRAINED_MODEL_NOT_READY });
    }

    this.validateCloneActionSpace(newModelDefinition.metadata.actionSpace, preTrainedModel.metadata.actionSpace);
    this.validateCloneSensors(newModelDefinition.metadata.sensors, preTrainedModel.metadata.sensors);
  }

  validateCloneActionSpace(newModelActionSpace: ActionSpace, preTrainedModelActionSpace: ActionSpace) {
    if (
      (newModelActionSpace.continous && !preTrainedModelActionSpace.continous) ||
      (newModelActionSpace.discrete && !preTrainedModelActionSpace.discrete)
    ) {
      logger.error(ErrorMessage.CLONE_ACTION_SPACE_TYPE_MISMATCH);
      throw new BadRequestError({ message: ErrorMessage.CLONE_ACTION_SPACE_TYPE_MISMATCH });
    }

    if (newModelActionSpace.discrete?.length !== preTrainedModelActionSpace.discrete?.length) {
      logger.error(ErrorMessage.CLONE_DISCRETE_ACTION_SPACE_COUNT_MISMATCH);
      throw new BadRequestError({ message: ErrorMessage.CLONE_DISCRETE_ACTION_SPACE_COUNT_MISMATCH });
    }
  }

  validateCloneSensors(newModelSensors: Sensors, preTrainedModelSensors: Sensors) {
    if (
      newModelSensors.camera !== preTrainedModelSensors.camera ||
      newModelSensors.lidar !== preTrainedModelSensors.lidar
    ) {
      logger.error(ErrorMessage.CLONE_SENSORS_MISMATCH);
      throw new BadRequestError({ message: ErrorMessage.CLONE_SENSORS_MISMATCH });
    }
  }
}

export const validator = new Validator();
