// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { CreateModelCommandInput } from '@deepracer-indy/typescript-client';

import type { CreateModelFormValues } from './types';

/**
 * The CreateModel request for the wizard's values. The pre-trained checkpoint is only sent with a
 * pre-trained model, since the API rejects one without the other.
 */
export const toCreateModelInput = (formValues: CreateModelFormValues): CreateModelCommandInput => ({
  modelDefinition: {
    name: formValues.modelName,
    description: formValues.description,
    carCustomization: formValues.carCustomization,
    trainingConfig: formValues.trainingConfig,
    metadata: formValues.metadata,
  },
  preTrainedModelId: formValues.preTrainedModelId,
  preTrainedCheckpoint: formValues.preTrainedModelId ? formValues.preTrainedCheckpoint : undefined,
});
