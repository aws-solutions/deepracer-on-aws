// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetModelCommand } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { mockModel, mockModelCheckpoints } from '#constants/testConstants';
import { modelsApi } from '#services/deepRacer/modelsApi';
import { mockDeepRacerClient } from '#utils/testUtils';

describe('modelsApi getModel query', () => {
  const store = configureStore({
    reducer: { [modelsApi.reducerPath]: modelsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(modelsApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(modelsApi.util.resetApiState());
  });

  it('returns the model with the checkpoints GetModel returns beside it', async () => {
    mockDeepRacerClient.on(GetModelCommand).resolvesOnce({ model: mockModel, checkpoints: mockModelCheckpoints });

    const result = await store.dispatch(modelsApi.endpoints.getModel.initiate({ modelId: mockModel.modelId })).unwrap();

    expect(result).toEqual({ ...mockModel, checkpoints: mockModelCheckpoints });
  });

  it('returns the model without checkpoints when GetModel has none', async () => {
    mockDeepRacerClient.on(GetModelCommand).resolvesOnce({ model: mockModel });

    const result = await store.dispatch(modelsApi.endpoints.getModel.initiate({ modelId: mockModel.modelId })).unwrap();

    expect(result.checkpoints).toBeUndefined();
  });
});
