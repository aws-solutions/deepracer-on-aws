// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CarLogAsset,
  CarLogAssetType,
  CarLogFetchJob,
  CarLogFetchStatus,
  CreateCarLogUploadCommand,
  DeleteCarLogAssetCommand,
  ListCarLogAssetsCommand,
  ListCarLogFetchesCommand,
  StartCarLogFetchCommand,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  carLogAssetAndListInvalidatesTags,
  carLogsApi,
  carLogFetchAndListInvalidatesTags,
  listCarLogAssetsProvidesTags,
  listCarLogFetchesProvidesTags,
} from '#services/deepRacer/carLogsApi';
import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from '#services/deepRacer/constants';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockAsset: CarLogAsset = {
  assetId: 'asset-001',
  profileId: 'profile-001',
  type: CarLogAssetType.VIDEO,
  filename: 'run-001.mp4',
  uploadedAt: new Date('2026-01-01T10:00:00Z'),
};

const mockJob: CarLogFetchJob = {
  jobId: 'job-001',
  status: CarLogFetchStatus.PROCESSING,
  createdAt: new Date('2026-01-01T10:00:00Z'),
};

describe('carLogsApi', () => {
  const store = configureStore({
    reducer: { [carLogsApi.reducerPath]: carLogsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(carLogsApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(carLogsApi.util.resetApiState());
  });

  it('paginates ListCarLogAssets and returns the assets array', async () => {
    mockDeepRacerClient.on(ListCarLogAssetsCommand).resolvesOnce({ assets: [mockAsset] });

    const result = await store.dispatch(carLogsApi.endpoints.listCarLogAssets.initiate({})).unwrap();

    expect(result).toEqual([mockAsset]);
    expect(mockDeepRacerClient.commandCalls(ListCarLogAssetsCommand)).toHaveLength(1);
  });

  it('paginates ListCarLogFetches and returns the jobs array', async () => {
    mockDeepRacerClient.on(ListCarLogFetchesCommand).resolvesOnce({ jobs: [mockJob] });

    const result = await store.dispatch(carLogsApi.endpoints.listCarLogFetches.initiate({})).unwrap();

    expect(result).toEqual([mockJob]);
    expect(mockDeepRacerClient.commandCalls(ListCarLogFetchesCommand)).toHaveLength(1);
  });

  it('startCarLogFetch sends a StartCarLogFetchCommand', async () => {
    mockDeepRacerClient.on(StartCarLogFetchCommand).resolvesOnce({ jobId: 'job-001' });

    const result = await store
      .dispatch(
        carLogsApi.endpoints.startCarLogFetch.initiate({
          instanceId: 'mi-001',
          racerName: 'SpeedRacer42',
        }),
      )
      .unwrap();

    expect(result.jobId).toBe('job-001');
    expect(mockDeepRacerClient.commandCalls(StartCarLogFetchCommand)).toHaveLength(1);
  });

  it('deleteCarLogAsset sends a DeleteCarLogAssetCommand', async () => {
    mockDeepRacerClient.on(DeleteCarLogAssetCommand).resolvesOnce({});

    await store
      .dispatch(
        carLogsApi.endpoints.deleteCarLogAsset.initiate({
          assetId: mockAsset.assetId,
          profileId: mockAsset.profileId,
        }),
      )
      .unwrap();

    expect(mockDeepRacerClient.commandCalls(DeleteCarLogAssetCommand)).toHaveLength(1);
  });

  it('createCarLogUpload sends a CreateCarLogUploadCommand', async () => {
    mockDeepRacerClient
      .on(CreateCarLogUploadCommand)
      .resolvesOnce({ jobId: 'job-002', url: 'https://example.com/upload' });

    const result = await store.dispatch(carLogsApi.endpoints.createCarLogUpload.initiate()).unwrap();

    expect(result.jobId).toBe('job-002');
    expect(mockDeepRacerClient.commandCalls(CreateCarLogUploadCommand)).toHaveLength(1);
  });

  it('listCarLogAssetsProvidesTags tags each asset plus the list', () => {
    expect(listCarLogAssetsProvidesTags([mockAsset])).toEqual([
      { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: mockAsset.assetId },
      { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: LIST_QUERY_TAG_ID },
    ]);
  });

  it('listCarLogFetchesProvidesTags tags each job plus the list', () => {
    expect(listCarLogFetchesProvidesTags([mockJob])).toEqual([
      { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: mockJob.jobId },
      { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID },
    ]);
  });

  it('invalidates asset and job tags with their list entries', () => {
    expect(carLogAssetAndListInvalidatesTags('asset-x')).toEqual([
      { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: 'asset-x' },
      { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: LIST_QUERY_TAG_ID },
    ]);
    expect(carLogFetchAndListInvalidatesTags('job-x')).toEqual([
      { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: 'job-x' },
      { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID },
    ]);
  });
});
