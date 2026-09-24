// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AssignEventFleetsCommand,
  AssignEventFleetsCommandInput,
  AssignEventFleetsCommandOutput,
  CreateFleetCommand,
  CreateFleetCommandInput,
  CreateFleetCommandOutput,
  DeleteFleetCommand,
  DeleteFleetCommandInput,
  Fleet,
  ListFleetsCommandInput,
  paginateListFleets,
  UpdateFleetCommand,
  UpdateFleetCommandInput,
  UpdateFleetCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const listFleetsProvidesTags = (result: Fleet[] = []) => [
  ...result.map(({ fleetId }) => ({ type: DeepRacerApiQueryTagType.FLEETS, id: fleetId })),
  { type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID },
];

export const fleetAndListInvalidatesTags = (fleetId: string) => [
  { type: DeepRacerApiQueryTagType.FLEETS, id: fleetId },
  { type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID },
];

const fleetListInvalidatesTags = [{ type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID }];

export const fleetsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listFleets: build.query<Fleet[], ListFleetsCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListFleets, dispatch, 'fleets'),
      providesTags: (result) => listFleetsProvidesTags(result),
    }),
    createFleet: build.mutation<string | undefined, CreateFleetCommandInput>({
      query: (input) => ({ command: new CreateFleetCommand(input) }),
      transformResponse: (response: CreateFleetCommandOutput) => response.fleetId,
      invalidatesTags: fleetListInvalidatesTags,
    }),
    updateFleet: build.mutation<Fleet | undefined, UpdateFleetCommandInput>({
      query: (input) => ({ command: new UpdateFleetCommand(input) }),
      transformResponse: (response: UpdateFleetCommandOutput) => response.fleet,
      invalidatesTags: (_result, _meta, { fleetId }) => fleetAndListInvalidatesTags(fleetId),
    }),
    deleteFleet: build.mutation<void, DeleteFleetCommandInput>({
      query: (input) => ({ command: new DeleteFleetCommand(input) }),
      invalidatesTags: (_result, _meta, { fleetId }) => fleetAndListInvalidatesTags(fleetId),
    }),
    assignEventFleets: build.mutation<AssignEventFleetsCommandOutput, AssignEventFleetsCommandInput>({
      query: (input) => ({ command: new AssignEventFleetsCommand(input) }),
      // Fleet→event assignment changes which devices an event sees; invalidate both lists.
      invalidatesTags: [
        { type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID },
        { type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID },
      ],
    }),
  }),
});

export const {
  useListFleetsQuery,
  useCreateFleetMutation,
  useUpdateFleetMutation,
  useDeleteFleetMutation,
  useAssignEventFleetsMutation,
} = fleetsApi;
