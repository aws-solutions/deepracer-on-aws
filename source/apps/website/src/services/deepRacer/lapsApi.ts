// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateLapCommand,
  CreateLapCommandInput,
  CreateLapCommandOutput,
  Lap,
  SetLapValidityCommand,
  SetLapValidityCommandInput,
  SetLapValidityCommandOutput,
  UpdateLapCommand,
  UpdateLapCommandInput,
  UpdateLapCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType } from './constants.js';
import { deepRacerApi } from './deepRacerApi.js';

/**
 * Laps are always read inline via GetRun's `laps` field — there is no
 * standalone ListLaps endpoint. Every lap mutation therefore
 * invalidates the parent run's LAPS tag so that any active GetRun
 * subscription for that run refetches with the updated lap list without
 * refetching ListRuns.
 */
export const lapMutationInvalidatesTags = (runId: string) => [{ type: DeepRacerApiQueryTagType.LAPS, id: runId }];

/** A validity change also rescores a submitted run, so the run is refetched along with its laps. */
export const lapValidityInvalidatesTags = (runId: string) => [
  { type: DeepRacerApiQueryTagType.RUNS, id: runId },
  ...lapMutationInvalidatesTags(runId),
];

export const lapsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    createLap: build.mutation<Lap, CreateLapCommandInput>({
      // RaceControls shows its own lap error and retries crossing laps, so a toast per failed
      // attempt (including an expected replay conflict) would only be noise.
      query: (input) => ({
        command: new CreateLapCommand(input),
        displayNotificationOnError: false,
      }),
      transformResponse: (response: CreateLapCommandOutput) => response.lap,
      invalidatesTags: (_result, _meta, { runId }) => lapMutationInvalidatesTags(runId),
    }),
    // The only setLapValidity endpoint: RTK Query keeps the first definition of a name, so a second
    // one elsewhere would make behaviour depend on module load order. Every caller (RecordedLaps,
    // RaceControls, RunLapsPanel) shows its own error, so no toast. Invalidates the run as well as
    // its laps, because validity changes rescore a submitted run.
    setLapValidity: build.mutation<SetLapValidityCommandOutput, SetLapValidityCommandInput>({
      query: (input) => ({
        command: new SetLapValidityCommand(input),
        displayNotificationOnError: false,
      }),
      invalidatesTags: (_result, _meta, { runId }) => lapValidityInvalidatesTags(runId),
    }),
    updateLap: build.mutation<UpdateLapCommandOutput, UpdateLapCommandInput>({
      query: (input) => ({
        command: new UpdateLapCommand(input),
      }),
      invalidatesTags: (_result, _meta, { runId }) => lapMutationInvalidatesTags(runId),
    }),
  }),
});

export const { useCreateLapMutation, useSetLapValidityMutation, useUpdateLapMutation } = lapsApi;
