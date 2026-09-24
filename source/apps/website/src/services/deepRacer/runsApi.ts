// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateRunCommand,
  CreateRunCommandInput,
  CreateRunCommandOutput,
  GetRunCommand,
  GetRunCommandInput,
  GetRunCommandOutput,
  Lap,
  ListRunsCommandInput,
  paginateListRuns,
  Run,
  SetLapValidityCommand,
  SetLapValidityCommandInput,
  SetLapValidityCommandOutput,
  TransitionRunStatusCommand,
  TransitionRunStatusCommandInput,
  TransitionRunStatusCommandOutput,
  UpdateLapCommand,
  UpdateLapCommandInput,
  UpdateLapCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

/** A Run together with its inline Laps, as returned by GetRun. */
export interface RunWithLaps {
  run: Run;
  laps: Lap[];
}

/**
 * Tag-computation helpers, exported so tests can bind directly to the same logic
 * used by the endpoint definitions below, rather than re-declaring local copies
 * that could silently drift from the shipping code.
 */
export const listRunsProvidesTags = (leaderboardId: string, result: Run[] = []) => [
  ...result.map(({ runId }) => ({
    type: DeepRacerApiQueryTagType.RUNS,
    id: runId,
  })),
  { type: DeepRacerApiQueryTagType.RUNS, id: `${leaderboardId}-${LIST_QUERY_TAG_ID}` },
];

export const getRunProvidesTags = (runId: string) => [
  { type: DeepRacerApiQueryTagType.RUNS, id: runId },
  { type: DeepRacerApiQueryTagType.LAPS, id: runId },
];

export const runAndListInvalidatesTags = (runId: string, leaderboardId: string) => [
  { type: DeepRacerApiQueryTagType.RUNS, id: runId },
  { type: DeepRacerApiQueryTagType.RUNS, id: `${leaderboardId}-${LIST_QUERY_TAG_ID}` },
];

export const runsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listRuns: build.query<Run[], ListRunsCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListRuns, dispatch, 'runs'),
      providesTags: (result, _meta, { leaderboardId }) => listRunsProvidesTags(leaderboardId, result),
    }),
    getRun: build.query<RunWithLaps, GetRunCommandInput>({
      query: (input) => ({
        command: new GetRunCommand(input),
        displayNotificationOnError: false,
      }),
      transformResponse: (response: GetRunCommandOutput) => ({ run: response.run, laps: response.laps }),
      providesTags: (_result, _meta, { runId }) => getRunProvidesTags(runId),
    }),
    createRun: build.mutation<Run, CreateRunCommandInput>({
      query: (input) => ({
        command: new CreateRunCommand(input),
      }),
      transformResponse: (response: CreateRunCommandOutput) => response.run,
      invalidatesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.RUNS, id: `${leaderboardId}-${LIST_QUERY_TAG_ID}` },
      ],
    }),
    transitionRunStatus: build.mutation<TransitionRunStatusCommandOutput, TransitionRunStatusCommandInput>({
      query: (input) => ({
        command: new TransitionRunStatusCommand(input),
      }),
      invalidatesTags: (_result, _meta, { runId, leaderboardId }) => runAndListInvalidatesTags(runId, leaderboardId),
    }),
    updateLap: build.mutation<UpdateLapCommandOutput, UpdateLapCommandInput>({
      query: (input) => ({
        command: new UpdateLapCommand(input),
        displayNotificationOnError: false,
      }),
      invalidatesTags: (_result, _meta, { runId }) => getRunProvidesTags(runId),
    }),
    setLapValidity: build.mutation<SetLapValidityCommandOutput, SetLapValidityCommandInput>({
      query: (input) => ({
        command: new SetLapValidityCommand(input),
        displayNotificationOnError: false,
      }),
      invalidatesTags: (_result, _meta, { runId }) => getRunProvidesTags(runId),
    }),
  }),
});

export const {
  useListRunsQuery,
  useGetRunQuery,
  useCreateRunMutation,
  useTransitionRunStatusMutation,
  useUpdateLapMutation,
  useSetLapValidityMutation,
} = runsApi;
