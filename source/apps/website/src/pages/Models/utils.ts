// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Model } from '@deepracer-indy/typescript-client';

import { initialFormValues, MIN_MAX_TIME_IN_MINUTES } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';

export const createCloneModelFormValues = (model: Model) => {
  // Imported models are stored with maxTimeInMinutes = 0 (they carry no training-time budget from
  // their origin account/service). Cloning is continue-training and needs a valid stop condition,
  // and the wizard validates the whole form before advancing — an out-of-range value silently
  // blocks the Next button. Fall back to the default when the source value is below the minimum.
  const clonedMaxTime = model.trainingConfig.maxTimeInMinutes;
  const maxTimeInMinutes =
    clonedMaxTime && clonedMaxTime >= MIN_MAX_TIME_IN_MINUTES
      ? clonedMaxTime
      : initialFormValues.trainingConfig.maxTimeInMinutes;

  const formValues: CreateModelFormValues = {
    modelName: model.name + '-clone',
    description: `Clone of ${model.name}`,
    trainingConfig: { ...model.trainingConfig, maxTimeInMinutes },
    metadata: model.metadata,
    preTrainedModelId: model.modelId,
    actionSpaceForm: {
      ...initialFormValues.actionSpaceForm,
      isAdvancedConfigOn: true,
    },
    carCustomization: model.carCustomization,
  };

  return formValues;
};
