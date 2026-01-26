// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateEvaluationCommand,
  CreateEvaluationCommandInput,
  CreateEvaluationCommandOutput,
  Evaluation,
  GetEvaluationCommand,
  GetEvaluationCommandInput,
  GetEvaluationCommandOutput,
  ListEvaluationsCommandInput,
  paginateListEvaluations,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const evaluationsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    getEvaluation: build.query<Evaluation, GetEvaluationCommandInput>({
      query: (input) => ({
        command: new GetEvaluationCommand(input),
      }),
      onQueryStarted: async ({ evaluationId, modelId }, { dispatch, queryFulfilled }) => {
        try {
          const { data: evaluation } = await queryFulfilled;
          // Update the retrieved evaluation in listEvaluations cache
          dispatch(
            evaluationsApi.util.updateQueryData('listEvaluations', { modelId }, (draftEvaluations) => {
              const draftEvaluation = draftEvaluations.find((e) => e.evaluationId === evaluationId);
              if (draftEvaluation) {
                Object.assign(draftEvaluation, evaluation);
              }
            }),
          );
        } catch {
          // no-op
        }
      },
      transformResponse: (response: GetEvaluationCommandOutput) => response.evaluation,
      providesTags: (_result, _meta, { evaluationId }) => [
        { type: DeepRacerApiQueryTagType.EVALUATIONS, id: evaluationId },
      ],
    }),
    listEvaluations: build.query<Evaluation[], ListEvaluationsCommandInput>({
      queryFn: async (input, { dispatch }) => {
        const result = await paginatedQuery(input, paginateListEvaluations, dispatch, 'evaluations');

        if (result.data) {
          // Sort evaluations newest to oldest
          result.data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        return result;
      },
      providesTags: (result = [], _meta, { modelId }) => [
        ...result.map(({ evaluationId }) => ({
          type: DeepRacerApiQueryTagType.EVALUATIONS,
          id: evaluationId,
        })),
        { type: DeepRacerApiQueryTagType.EVALUATIONS, id: modelId },
      ],
    }),
    createEvaluation: build.mutation<string, CreateEvaluationCommandInput>({
      query: (input) => ({
        command: new CreateEvaluationCommand(input),
      }),
      transformResponse: (response: CreateEvaluationCommandOutput) => response.evaluationId,
      invalidatesTags: (_result, _meta, { modelId }) => [
        { type: DeepRacerApiQueryTagType.MODELS, id: modelId },
        { type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID },
        { type: DeepRacerApiQueryTagType.EVALUATIONS, id: modelId },
      ],
    }),
  }),
});

export const { useGetEvaluationQuery, useListEvaluationsQuery, useCreateEvaluationMutation } = evaluationsApi;
