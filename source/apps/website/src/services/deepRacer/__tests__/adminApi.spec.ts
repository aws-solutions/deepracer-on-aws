// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetAdminAssetUrlCommand,
  ListAdminModelsCommand,
  ListAdminProfilesCommand,
  ListModelsForProfileCommand,
  ModelStatus,
  OptimizationStatus,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { adminApi } from '#services/deepRacer/adminApi';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockAdminModel = {
  modelId: 'model-001',
  name: 'TestModel',
  username: 'alice',
  profileId: 'profile-001',
  status: ModelStatus.READY,
  optimizationStatus: OptimizationStatus.OPTIMIZED,
  createdAt: new Date('2026-06-01'),
};

describe('adminApi', () => {
  const store = configureStore({
    reducer: { [adminApi.reducerPath]: adminApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(adminApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(adminApi.util.resetApiState());
  });

  describe('listAdminModels query', () => {
    it('sends ListAdminModelsCommand and transforms response', async () => {
      mockDeepRacerClient.on(ListAdminModelsCommand).resolvesOnce({ models: [mockAdminModel] });

      const result = await store.dispatch(adminApi.endpoints.listAdminModels.initiate({})).unwrap();

      expect(result).toEqual([mockAdminModel]);
      expect(mockDeepRacerClient.commandCalls(ListAdminModelsCommand)).toHaveLength(1);
    });

    it('returns empty array when no models', async () => {
      mockDeepRacerClient.on(ListAdminModelsCommand).resolvesOnce({ models: [] });

      const result = await store.dispatch(adminApi.endpoints.listAdminModels.initiate({})).unwrap();

      expect(result).toEqual([]);
    });
  });

  describe('listAdminProfiles query', () => {
    it('sends ListAdminProfilesCommand and transforms response', async () => {
      const profiles = [{ profileId: 'p1', alias: 'alice', emailAddress: 'a@b.com', totalModelCount: 2 }];
      mockDeepRacerClient.on(ListAdminProfilesCommand).resolvesOnce({ profiles });

      const result = await store.dispatch(adminApi.endpoints.listAdminProfiles.initiate()).unwrap();

      expect(result).toEqual(profiles);
    });
  });

  describe('getAdminAssetUrl query', () => {
    it('sends GetAdminAssetUrlCommand and returns response', async () => {
      const response = { url: 'https://s3.example.com/model.tar.gz', filename: 'model.tar.gz' };
      mockDeepRacerClient.on(GetAdminAssetUrlCommand).resolvesOnce(response);

      const result = await store
        .dispatch(adminApi.endpoints.getAdminAssetUrl.initiate({ modelId: 'model-001', profileId: 'profile-001' }))
        .unwrap();

      expect(result.url).toBe(response.url);
      expect(result.filename).toBe(response.filename);
    });
  });

  describe('listModelsForProfile query', () => {
    it('sends ListModelsForProfileCommand and transforms response', async () => {
      const models = [{ modelId: 'm1', name: 'Model1', status: ModelStatus.READY, createdAt: new Date() }];
      mockDeepRacerClient.on(ListModelsForProfileCommand).resolvesOnce({ models });

      const result = await store
        .dispatch(adminApi.endpoints.listModelsForProfile.initiate({ profileId: 'profile-001' }))
        .unwrap();

      expect(result).toEqual(models);
    });
  });
});
