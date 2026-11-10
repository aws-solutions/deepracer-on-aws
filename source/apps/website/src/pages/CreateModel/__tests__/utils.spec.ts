// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CheckpointSelection } from '@deepracer-indy/typescript-client';

import { initialFormValues } from '../constants';
import { toCreateModelInput } from '../utils';

describe('toCreateModelInput()', () => {
  it("sends the pre-trained model's chosen checkpoint with a clone", () => {
    const input = toCreateModelInput({
      ...initialFormValues,
      preTrainedModelId: 'source-model',
      preTrainedCheckpoint: CheckpointSelection.LAST,
    });

    expect(input).toMatchObject({ preTrainedModelId: 'source-model', preTrainedCheckpoint: CheckpointSelection.LAST });
  });

  it('sends no checkpoint for a new model, even if one is left in the form', () => {
    const input = toCreateModelInput({ ...initialFormValues, preTrainedCheckpoint: CheckpointSelection.LAST });

    expect(input.preTrainedModelId).toBeUndefined();
    expect(input.preTrainedCheckpoint).toBeUndefined();
  });

  it('maps the model definition from the form', () => {
    const input = toCreateModelInput({ ...initialFormValues, modelName: 'my-model', description: 'about it' });

    expect(input.modelDefinition).toEqual({
      name: 'my-model',
      description: 'about it',
      carCustomization: initialFormValues.carCustomization,
      trainingConfig: initialFormValues.trainingConfig,
      metadata: initialFormValues.metadata,
    });
  });
});
