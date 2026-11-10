// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CarCustomization,
  CheckpointSelection,
  ModelMetadata,
  TrainingConfig,
} from '@deepracer-indy/typescript-client';

export interface ActionSpaceWizardValues {
  steeringAngleGranularity: number;
  maxSteeringAngle: number;
  speedGranularity: number;
  maxSpeed: number;
  isAdvancedConfigOn: boolean;
}

export interface CreateModelFormValues {
  modelName: string;
  description?: string;
  trainingConfig: TrainingConfig;
  metadata: ModelMetadata;
  preTrainedModelId?: string;
  /** The pre-trained model's checkpoint a clone starts from. */
  preTrainedCheckpoint?: CheckpointSelection;
  actionSpaceForm: ActionSpaceWizardValues;
  carCustomization: CarCustomization;
}
