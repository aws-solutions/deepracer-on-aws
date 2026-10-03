// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus, Model, ModelStatus } from '@deepracer-indy/typescript-client';
import { describe, it, expect } from 'vitest';

import { initialFormValues, MIN_MAX_TIME_IN_MINUTES } from '#pages/CreateModel/constants';

import { createCloneModelFormValues } from '../utils';

const buildModel = (maxTimeInMinutes: number): Model => ({
  modelId: 'model-1',
  name: 'My Model',
  createdAt: new Date(),
  fileSizeInBytes: 0,
  status: ModelStatus.READY,
  trainingMetricsUrl: '',
  trainingStatus: JobStatus.COMPLETED,
  carCustomization: initialFormValues.carCustomization,
  metadata: initialFormValues.metadata,
  trainingConfig: { ...initialFormValues.trainingConfig, maxTimeInMinutes },
});

describe('createCloneModelFormValues', () => {
  it('copies name (as -clone), preTrainedModelId, and training config from the source model', () => {
    const result = createCloneModelFormValues(buildModel(60));

    expect(result.modelName).toBe('My Model-clone');
    expect(result.preTrainedModelId).toBe('model-1');
    expect(result.trainingConfig.trackConfig).toEqual(initialFormValues.trainingConfig.trackConfig);
  });

  it('preserves a valid maxTimeInMinutes from the source model', () => {
    const result = createCloneModelFormValues(buildModel(60));

    expect(result.trainingConfig.maxTimeInMinutes).toBe(60);
  });

  // Imported models are stored with maxTimeInMinutes = 0, which is below the schema minimum and
  // silently blocks the wizard's Next button on clone. It must be reset to a valid default.
  it('resets maxTimeInMinutes to the default when the source value is 0 (imported model)', () => {
    const result = createCloneModelFormValues(buildModel(0));

    expect(result.trainingConfig.maxTimeInMinutes).toBe(initialFormValues.trainingConfig.maxTimeInMinutes);
    expect(result.trainingConfig.maxTimeInMinutes).toBeGreaterThanOrEqual(MIN_MAX_TIME_IN_MINUTES);
  });

  it('resets maxTimeInMinutes to the default when the source value is below the minimum', () => {
    const result = createCloneModelFormValues(buildModel(MIN_MAX_TIME_IN_MINUTES - 1));

    expect(result.trainingConfig.maxTimeInMinutes).toBe(initialFormValues.trainingConfig.maxTimeInMinutes);
  });
});
