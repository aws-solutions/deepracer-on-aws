// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ClearLiveLeaderboardCommand,
  ClearLiveLeaderboardCommandInput,
  CreateLeaderboardCommand,
  CreateLeaderboardCommandInput,
  CreateLeaderboardCommandOutput,
  DeclareWinnerCommand,
  DeclareWinnerCommandInput,
  DeclareWinnerCommandOutput,
  DeleteLeaderboardCommand,
  DeleteLeaderboardCommandInput,
  EditLeaderboardCommand,
  EditLeaderboardCommandInput,
  EditLeaderboardCommandOutput,
  GetLeaderboardCommand,
  GetLeaderboardCommandInput,
  GetLeaderboardCommandOutput,
  GetLiveRaceStateCommand,
  GetLiveRaceStateCommandInput,
  GetLiveRaceStateCommandOutput,
  LaunchLiveRaceCommand,
  LaunchLiveRaceCommandInput,
  Leaderboard,
  ListLiveQueueItemsCommand,
  ListLiveQueueItemsCommandInput,
  ListLiveQueueItemsCommandOutput,
  RemoveLiveQueueItemCommand,
  RemoveLiveQueueItemCommandInput,
  ReorderLiveQueueCommand,
  ReorderLiveQueueCommandInput,
  ResetLiveQueueModelCommand,
  ResetLiveQueueModelCommandInput,
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
    getLiveRaceState: build.query<GetLiveRaceStateCommandOutput, GetLiveRaceStateCommandInput>({
      query: (input) => ({
        command: new GetLiveRaceStateCommand(input),
      }),
    }),
    listLiveQueueItems: build.query<ListLiveQueueItemsCommandOutput, ListLiveQueueItemsCommandInput>({
      query: (input) => ({
        command: new ListLiveQueueItemsCommand(input),
      }),
    }),
    launchLiveRace: build.mutation<void, LaunchLiveRaceCommandInput>({
      query: (input) => ({
        command: new LaunchLiveRaceCommand(input),
      }),
    }),
    declareWinner: build.mutation<DeclareWinnerCommandOutput, DeclareWinnerCommandInput>({
      query: (input) => ({
        command: new DeclareWinnerCommand(input),
      }),
    }),
    reorderLiveQueue: build.mutation<void, ReorderLiveQueueCommandInput>({
      query: (input) => ({
        command: new ReorderLiveQueueCommand(input),
      }),
    }),
    removeLiveQueueItem: build.mutation<void, RemoveLiveQueueItemCommandInput>({
      query: (input) => ({
        command: new RemoveLiveQueueItemCommand(input),
      }),
    }),
    resetLiveQueueModel: build.mutation<void, ResetLiveQueueModelCommandInput>({
      query: (input) => ({
        command: new ResetLiveQueueModelCommand(input),
      }),
    }),
    clearLiveLeaderboard: build.mutation<void, ClearLiveLeaderboardCommandInput>({
      query: (input) => ({
        command: new ClearLiveLeaderboardCommand(input),
      }),
    }),
  }),
});

export const {
  useGetLeaderboardQuery,
  useGetLiveRaceStateQuery,
  useListLeaderboardsQuery,
  useListLiveQueueItemsQuery,
  useLaunchLiveRaceMutation,
  useDeclareWinnerMutation,
  useReorderLiveQueueMutation,
  useRemoveLiveQueueItemMutation,
  useResetLiveQueueModelMutation,
  useClearLiveLeaderboardMutation,
  useCreateLeaderboardMutation,
  useDeleteLeaderboardMutation,
  useEditLeaderboardMutation,
} = leaderboardsApi;
