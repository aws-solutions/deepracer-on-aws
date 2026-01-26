// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Model } from '@deepracer-indy/typescript-client';

import { initialFormValues } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';

export const createCloneModelFormValues = (model: Model) => {
  const formValues: CreateModelFormValues = {
    modelName: model.name + '-clone',
    description: `Clone of ${model.name}`,
    trainingConfig: model.trainingConfig,
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
