// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImportModelCommand } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { modelsApi } from '#services/deepRacer/modelsApi';
import { uploadModelFiles } from '#services/deepRacer/uploadUtils';

const mockSend = vi.fn();
vi.mock('#services/deepRacer/deepRacerClient', () => ({
  deepRacerClient: { send: (...args: unknown[]) => mockSend(...args) },
}));
vi.mock('#services/deepRacer/uploadUtils');
vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    region: 'us-west-2',
    uploadBucketName: 'test-bucket',
  },
}));

const createStore = () =>
  configureStore({
    reducer: {
      [modelsApi.reducerPath]: modelsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(modelsApi.middleware),
  });

describe('modelsApi', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createStore();
  });

  describe('getTrainingMetrics query', () => {
    it('returns parsed metrics from the URL', async () => {
      const mockMetrics = [{ episode: 1, reward: 10 }];
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ metrics: mockMetrics }),
      });

      const result = await store
        .dispatch(modelsApi.endpoints.getTrainingMetrics.initiate('https://example.com/metrics.json'))
        .unwrap();

      expect(result).toEqual(mockMetrics);
    });

    it('returns error message when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

      const result = await store.dispatch(modelsApi.endpoints.getTrainingMetrics.initiate('https://example.com/bad'));

      expect(result.error).toBeDefined();
    });
  });

  describe('createModel mutation', () => {
    it('endpoint is configured', () => {
      expect(modelsApi.endpoints.createModel).toBeDefined();
      const action = modelsApi.endpoints.createModel.initiate({ modelName: 'My Model' } as never);
      expect(typeof action).toBe('function');
    });
  });

  describe('stopModel mutation', () => {
    it('endpoint is configured', () => {
      expect(modelsApi.endpoints.stopModel).toBeDefined();
      const action = modelsApi.endpoints.stopModel.initiate({ modelId: 'model-1' } as never);
      expect(typeof action).toBe('function');
    });
  });

  describe('retryTraining mutation', () => {
    it('endpoint is configured', () => {
      expect(modelsApi.endpoints.retryTraining).toBeDefined();
      const action = modelsApi.endpoints.retryTraining.initiate({ modelId: 'model-1' });
      expect(typeof action).toBe('function');
    });
  });

  describe('testRewardFunction mutation', () => {
    it('endpoint is configured', () => {
      expect(modelsApi.endpoints.testRewardFunction).toBeDefined();
      const action = modelsApi.endpoints.testRewardFunction.initiate({
        rewardFunction: 'def reward(p): return 1',
      } as never);
      expect(typeof action).toBe('function');
    });
  });

  describe('importModel mutation', () => {
    it('should successfully import model with progress tracking', async () => {
      const files = [
        new File(['content1'], 'model/model.pb', { type: 'application/octet-stream' }),
        new File(['content2'], 'model/checkpoint', { type: 'text/plain' }),
      ];

      const onProgress = vi.fn();
      vi.mocked(uploadModelFiles).mockResolvedValueOnce('uploads/models/test');
      mockSend.mockImplementationOnce(() => Promise.resolve({ modelId: 'test-model-id' }));

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
      expect(mockSend).toHaveBeenCalledWith(expect.any(ImportModelCommand));
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('should return error when upload fails', async () => {
      const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
      const error = new Error('Failed to upload files.');
      vi.mocked(uploadModelFiles).mockRejectedValueOnce(error);

      const result = await store.dispatch(modelsApi.endpoints.importModel.initiate({ modelName: 'Test Model', files }));
      expect(result.error).toBe(error);
    });

    it('should handle undefined modelDescription', async () => {
      const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
      vi.mocked(uploadModelFiles).mockResolvedValueOnce('uploads/models/test');
      mockSend.mockImplementationOnce(() => Promise.resolve({ modelId: 'test-model-id' }));

      const result = await store
        .dispatch(modelsApi.endpoints.importModel.initiate({ modelName: 'Test Model', files }))
        .unwrap();

      expect(result).toEqual({ modelId: 'test-model-id', progress: 100 });
    });
  });

  describe('importPhysicalModel mutation', () => {
    it('endpoint is configured', () => {
      expect(modelsApi.endpoints.importPhysicalModel).toBeDefined();
      const action = modelsApi.endpoints.importPhysicalModel.initiate({
        modelName: 'PhysicalModel',
        s3Bucket: 'test-bucket',
        s3Path: 'uploads/physical-models/profile/abc.tar.gz',
      });
      expect(typeof action).toBe('function');
    });
  });

  describe('packageModel mutation', () => {
    it('endpoint is configured', () => {
      expect(modelsApi.endpoints.packageModel).toBeDefined();
      const action = modelsApi.endpoints.packageModel.initiate({ modelId: 'model-1', profileId: 'profile-1' });
      expect(typeof action).toBe('function');
    });
  });

  describe('deployModel mutation', () => {
    it('endpoint is defined and initiate returns a thunk', () => {
      expect(modelsApi.endpoints.deployModel).toBeDefined();
      const action = modelsApi.endpoints.deployModel.initiate({
        modelId: 'model-1',
        profileId: 'profile-1',
        carInstanceId: 'i-abc',
        eventId: 'event-1',
        batchId: 'batch-1',
      });
      expect(typeof action).toBe('function');
    });
  });

  describe('getDeployment query', () => {
    it('endpoint is configured and initiate produces a dispatchable thunk', () => {
      expect(modelsApi.endpoints.getDeployment).toBeDefined();
      const action = modelsApi.endpoints.getDeployment.initiate({ deploymentId: 'deploy-123', modelId: 'model-abc' });
      expect(typeof action).toBe('function');
    });
  });

  describe('listDeploymentsByBatch query', () => {
    it('endpoint is configured and initiate produces a dispatchable thunk', () => {
      expect(modelsApi.endpoints.listDeploymentsByBatch).toBeDefined();
      const action = modelsApi.endpoints.listDeploymentsByBatch.initiate({ batchId: 'batch-xyz' });
      expect(typeof action).toBe('function');
    });
  });
});
