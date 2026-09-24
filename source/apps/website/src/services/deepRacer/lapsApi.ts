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

export const lapsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    createLap: build.mutation<Lap, CreateLapCommandInput>({
      query: (input) => ({
        command: new CreateLapCommand(input),
      }),
      transformResponse: (response: CreateLapCommandOutput) => response.lap,
      invalidatesTags: (_result, _meta, { runId }) => lapMutationInvalidatesTags(runId),
    }),
    setLapValidity: build.mutation<SetLapValidityCommandOutput, SetLapValidityCommandInput>({
      query: (input) => ({
        command: new SetLapValidityCommand(input),
      }),
      invalidatesTags: (_result, _meta, { runId }) => lapMutationInvalidatesTags(runId),
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
