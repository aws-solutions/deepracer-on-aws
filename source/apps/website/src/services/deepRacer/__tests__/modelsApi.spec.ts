// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImportModelCommand } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deepRacerClient } from '#services/deepRacer/deepRacerClient';
import { modelsApi } from '#services/deepRacer/modelsApi';
import { uploadModelFiles } from '#services/deepRacer/uploadUtils';

vi.mock('#services/deepRacer/deepRacerClient', () => ({
  deepRacerClient: {
    send: vi.fn(),
  },
}));
vi.mock('#services/deepRacer/uploadUtils');
vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    region: 'us-west-2',
    uploadBucketName: 'test-bucket',
  },
}));

describe('modelsApi', () => {
  const store = configureStore({
    reducer: {
      [modelsApi.reducerPath]: modelsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(modelsApi.middleware),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importModel mutation', () => {
    it('should successfully import model with progress tracking', async () => {
      const files = [
        new File(['content1'], 'model/model.pb', { type: 'application/octet-stream' }),
        new File(['content2'], 'model/checkpoint', { type: 'text/plain' }),
      ];

      const onProgress = vi.fn();
      vi.mocked(uploadModelFiles).mockResolvedValueOnce('uploads/models/test');
      vi.mocked(deepRacerClient.send).mockImplementationOnce(() => Promise.resolve({ modelId: 'test-model-id' }));

      const result = await store
        .dispatch(
          modelsApi.endpoints.importModel.initiate({
            modelName: 'Test Model',
            modelDescription: 'Test Description',
            files,
            onProgress,
          }),
        )
        .unwrap();

      expect(result).toEqual({ modelId: 'test-model-id', progress: 100 });
      expect(uploadModelFiles).toHaveBeenCalledWith(files, onProgress);
      expect(deepRacerClient.send).toHaveBeenCalledWith(expect.any(ImportModelCommand));
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('should propagate upload errors from uploadModelFiles or ImportModelCommand', async () => {
      const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
      const error = new Error('Failed to upload files. Please try again later.');
      vi.mocked(uploadModelFiles).mockRejectedValueOnce(error);

      const result = await store.dispatch(
        modelsApi.endpoints.importModel.initiate({
          modelName: 'Test Model',
          files,
        }),
      );
      expect(result.error).toBe(error);
    });

    it('should handle undefined modelDescription', async () => {
      const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
      vi.mocked(uploadModelFiles).mockResolvedValueOnce('uploads/models/test');
      vi.mocked(deepRacerClient.send).mockImplementationOnce(() => Promise.resolve({ modelId: 'test-model-id' }));

      const result = await store
        .dispatch(
          modelsApi.endpoints.importModel.initiate({
            modelName: 'Test Model',
            files,
          }),
        )
        .unwrap();

      expect(result).toEqual({ modelId: 'test-model-id', progress: 100 });
      expect(deepRacerClient.send).toHaveBeenCalledWith(expect.any(ImportModelCommand));
    });
  });
});
