// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CreateModelCommand,
  CreateModelCommandInput,
  CreateModelCommandOutput,
  DeleteModelCommand,
  DeleteModelCommandInput,
  GetAssetUrlCommand,
  GetAssetUrlCommandInput,
  GetAssetUrlCommandOutput,
  GetModelCommand,
  GetModelCommandInput,
  GetModelCommandOutput,
  ImportModelCommand,
  Model,
  ModelStatus,
  paginateListModels,
  RewardFunctionError,
  StopModelCommand,
  StopModelCommandInput,
  TestRewardFunctionCommand,
  TestRewardFunctionCommandInput,
  TestRewardFunctionCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';
import { deepRacerClient } from './deepRacerClient.js';
import { uploadModelFiles } from './uploadUtils.js';
import type { TrainingMetric } from '../../types/trainingMetrics.js';
import { environmentConfig } from '../../utils/envUtils.js';

export const modelsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    getModel: build.query<Model, GetModelCommandInput>({
      query: (input) => ({
        command: new GetModelCommand(input),
      }),
      transformResponse: (response: GetModelCommandOutput) => response.model,
      providesTags: (_result, _meta, { modelId }) => [{ type: DeepRacerApiQueryTagType.MODELS, id: modelId }],
    }),
    listModels: build.query<Model[], void>({
      queryFn: (_input, { dispatch }) => paginatedQuery({}, paginateListModels, dispatch, 'models'),
      providesTags: (result = []) => [
        ...result.map(({ modelId }) => ({
          type: DeepRacerApiQueryTagType.MODELS,
          id: modelId,
        })),
        { type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID },
      ],
    }),
    getTrainingMetrics: build.query<TrainingMetric[], string>({
      queryFn: async (trainingMetricsUrl) => {
        try {
          const response = await fetch(trainingMetricsUrl);
          const responseJson = await response.json();

          return { data: responseJson.metrics };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),
    createModel: build.mutation<string, CreateModelCommandInput>({
      query: (input) => ({
        command: new CreateModelCommand(input),
      }),
      transformResponse: (response: CreateModelCommandOutput) => response.modelId,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID }],
    }),
    deleteModel: build.mutation<void, DeleteModelCommandInput>({
      query: (input) => ({
        command: new DeleteModelCommand(input),
      }),
      invalidatesTags: () => [{ type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID }],
    }),
    stopModel: build.mutation<void, StopModelCommandInput>({
      query: (input) => ({
        command: new StopModelCommand(input),
      }),
      invalidatesTags: (_result, _meta, { modelId }) => [
        { type: DeepRacerApiQueryTagType.MODELS, id: modelId },
        { type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID },
        { type: DeepRacerApiQueryTagType.EVALUATIONS, id: modelId },
        { type: DeepRacerApiQueryTagType.SUBMISSIONS },
      ],
    }),
    getAssetUrl: build.mutation<string, GetAssetUrlCommandInput>({
      query: (input) => ({
        command: new GetAssetUrlCommand(input),
      }),
      transformResponse: (response: GetAssetUrlCommandOutput): string =>
        response?.status === ModelStatus.QUEUED ? ModelStatus.QUEUED : (response?.url ?? ''),
      invalidatesTags: (_result, _meta, { modelId }) => [
        { type: DeepRacerApiQueryTagType.MODELS, id: modelId },
        { type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID },
      ],
    }),
    testRewardFunction: build.mutation<RewardFunctionError[], TestRewardFunctionCommandInput>({
      query: (input) => ({
        command: new TestRewardFunctionCommand(input),
      }),
      transformResponse: (response: TestRewardFunctionCommandOutput) => response.errors,
    }),
    importModel: build.mutation<
      { modelId: string; progress: number },
      {
        modelName: string;
        modelDescription?: string;
        files: File[];
        onProgress?: (progress: number, completedFile?: string) => void;
      }
    >({
      async queryFn({ modelName, modelDescription, files, onProgress }, { dispatch }) {
        try {
          const s3Path = await uploadModelFiles(files, onProgress);

          const command = new ImportModelCommand({
            modelName,
            modelDescription: modelDescription || undefined,
            s3Bucket: environmentConfig.uploadBucketName,
            s3Path,
          });

          const response = await deepRacerClient.send(command);
          onProgress?.(100);

          return { data: { modelId: response.modelId, progress: 100 } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID }],
    }),
  }),
});

export const {
  useGetModelQuery,
  useGetTrainingMetricsQuery,
  useListModelsQuery,
  useGetAssetUrlMutation,
  useCreateModelMutation,
  useDeleteModelMutation,
  useStopModelMutation,
  useTestRewardFunctionMutation,
  useImportModelMutation,
} = modelsApi;
