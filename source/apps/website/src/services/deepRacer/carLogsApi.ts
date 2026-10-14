// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CarLogAsset,
  CarLogFetchJob,
  CreateCarLogUploadCommand,
  CreateCarLogUploadCommandInput,
  CreateCarLogUploadCommandOutput,
  DeleteCarLogAssetCommand,
  DeleteCarLogAssetCommandInput,
  GetCarLogAssetUrlsCommand,
  GetCarLogAssetUrlsCommandInput,
  GetCarLogAssetUrlsCommandOutput,
  GetCarLogFetchCommand,
  GetCarLogFetchCommandInput,
  GetCarLogFetchCommandOutput,
  ListCarLogAssetsCommandInput,
  ListCarLogFetchesCommandInput,
  StartCarLogFetchCommand,
  StartCarLogFetchCommandInput,
  StartCarLogFetchCommandOutput,
  paginateListCarLogAssets,
  paginateListCarLogFetches,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const listCarLogAssetsProvidesTags = (result: CarLogAsset[] = []) => [
  ...result.map(({ assetId }) => ({ type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: assetId })),
  { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: LIST_QUERY_TAG_ID },
];

export const listCarLogFetchesProvidesTags = (result: CarLogFetchJob[] = []) => [
  ...result.map(({ jobId }) => ({ type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: jobId })),
  { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID },
];

export const carLogAssetAndListInvalidatesTags = (assetId: string) => [
  { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: assetId },
  { type: DeepRacerApiQueryTagType.CAR_LOG_ASSETS, id: LIST_QUERY_TAG_ID },
];

export const carLogFetchAndListInvalidatesTags = (jobId: string) => [
  { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: jobId },
  { type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID },
];

export const carLogsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listCarLogAssets: build.query<CarLogAsset[], ListCarLogAssetsCommandInput | void>({
      queryFn: (input, { dispatch }) => paginatedQuery(input ?? {}, paginateListCarLogAssets, dispatch, 'assets'),
      providesTags: (result) => listCarLogAssetsProvidesTags(result),
    }),
    listCarLogFetches: build.query<CarLogFetchJob[], ListCarLogFetchesCommandInput | void>({
      queryFn: (input, { dispatch }) => paginatedQuery(input ?? {}, paginateListCarLogFetches, dispatch, 'jobs'),
      providesTags: (result) => listCarLogFetchesProvidesTags(result),
    }),
    getCarLogFetch: build.query<CarLogFetchJob, GetCarLogFetchCommandInput>({
      query: (input) => ({ command: new GetCarLogFetchCommand(input) }),
      transformResponse: (response: GetCarLogFetchCommandOutput) => response.job,
      providesTags: (_result, _meta, { jobId }) => [{ type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: jobId }],
    }),
    startCarLogFetch: build.mutation<StartCarLogFetchCommandOutput, StartCarLogFetchCommandInput>({
      query: (input) => ({ command: new StartCarLogFetchCommand(input), displayNotificationOnError: false }),
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID }],
    }),
    getCarLogAssetUrls: build.mutation<GetCarLogAssetUrlsCommandOutput, GetCarLogAssetUrlsCommandInput>({
      query: (input) => ({ command: new GetCarLogAssetUrlsCommand(input), displayNotificationOnError: false }),
    }),
    deleteCarLogAsset: build.mutation<void, DeleteCarLogAssetCommandInput>({
      query: (input) => ({ command: new DeleteCarLogAssetCommand(input), displayNotificationOnError: false }),
      invalidatesTags: (_result, _meta, { assetId }) => carLogAssetAndListInvalidatesTags(assetId),
    }),
    createCarLogUpload: build.mutation<CreateCarLogUploadCommandOutput, CreateCarLogUploadCommandInput | void>({
      query: (input) => ({ command: new CreateCarLogUploadCommand(input ?? {}), displayNotificationOnError: false }),
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.CAR_LOG_FETCHES, id: LIST_QUERY_TAG_ID }],
    }),
  }),
});

export const {
  useListCarLogAssetsQuery,
  useListCarLogFetchesQuery,
  useGetCarLogFetchQuery,
  useStartCarLogFetchMutation,
  useGetCarLogAssetUrlsMutation,
  useDeleteCarLogAssetMutation,
  useCreateCarLogUploadMutation,
} = carLogsApi;
