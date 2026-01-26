// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateSubmissionCommand,
  CreateSubmissionCommandInput,
  CreateSubmissionCommandOutput,
  ListSubmissionsCommandInput,
  paginateListSubmissions,
  Submission,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const submissionsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listSubmissions: build.query<Submission[], ListSubmissionsCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListSubmissions, dispatch, 'submissions'),
      providesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.SUBMISSIONS, id: leaderboardId },
      ],
    }),
    createSubmission: build.mutation<string, CreateSubmissionCommandInput>({
      query: (input) => ({
        command: new CreateSubmissionCommand(input),
      }),
      transformResponse: (response: CreateSubmissionCommandOutput) => response.submissionId,
      invalidatesTags: (_result, _meta, { leaderboardId, modelId }) => [
        { type: DeepRacerApiQueryTagType.MODELS, id: modelId },
        { type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID },
        { type: DeepRacerApiQueryTagType.SUBMISSIONS, id: leaderboardId },
      ],
    }),
  }),
});

export const { useListSubmissionsQuery, useCreateSubmissionMutation } = submissionsApi;
