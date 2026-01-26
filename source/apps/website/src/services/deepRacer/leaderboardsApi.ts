// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateLeaderboardCommand,
  CreateLeaderboardCommandInput,
  CreateLeaderboardCommandOutput,
  DeleteLeaderboardCommand,
  DeleteLeaderboardCommandInput,
  EditLeaderboardCommand,
  EditLeaderboardCommandInput,
  EditLeaderboardCommandOutput,
  GetLeaderboardCommand,
  GetLeaderboardCommandInput,
  GetLeaderboardCommandOutput,
  Leaderboard,
  paginateListLeaderboards,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const leaderboardsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    getLeaderboard: build.query<Leaderboard, GetLeaderboardCommandInput>({
      query: (input) => ({
        command: new GetLeaderboardCommand(input),
      }),
      transformResponse: (response: GetLeaderboardCommandOutput) => response.leaderboard,
      providesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: leaderboardId },
      ],
    }),
    listLeaderboards: build.query<Leaderboard[], void>({
      queryFn: (_input, { dispatch }) => paginatedQuery({}, paginateListLeaderboards, dispatch, 'leaderboards'),
      providesTags: (result = []) => [
        ...result.map(({ leaderboardId }) => ({
          type: DeepRacerApiQueryTagType.LEADERBOARDS,
          id: leaderboardId,
        })),
        { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: LIST_QUERY_TAG_ID },
      ],
    }),
    createLeaderboard: build.mutation<string, CreateLeaderboardCommandInput>({
      query: (input) => ({
        command: new CreateLeaderboardCommand(input),
      }),
      transformResponse: (response: CreateLeaderboardCommandOutput) => response.leaderboardId,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.LEADERBOARDS, id: LIST_QUERY_TAG_ID }],
    }),
    deleteLeaderboard: build.mutation<string, DeleteLeaderboardCommandInput>({
      query: (input) => ({
        command: new DeleteLeaderboardCommand(input),
      }),
      invalidatesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: leaderboardId },
        { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: LIST_QUERY_TAG_ID },
      ],
    }),
    editLeaderboard: build.mutation<Leaderboard, EditLeaderboardCommandInput>({
      query: (input) => ({
        command: new EditLeaderboardCommand(input),
      }),
      transformResponse: (response: EditLeaderboardCommandOutput) => response.leaderboard,
      invalidatesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: leaderboardId },
        { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: LIST_QUERY_TAG_ID },
      ],
    }),
  }),
});

export const {
  useGetLeaderboardQuery,
  useListLeaderboardsQuery,
  useCreateLeaderboardMutation,
  useDeleteLeaderboardMutation,
  useEditLeaderboardMutation,
} = leaderboardsApi;
