// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AddTrackToEventCommand,
  AddTrackToEventCommandInput,
  AddTrackToEventCommandOutput,
  CreateEventCommand,
  CreateEventCommandInput,
  CreateEventCommandOutput,
  DeleteEventCommand,
  DeleteEventCommandInput,
  EditEventCommand,
  EditEventCommandInput,
  EditEventCommandOutput,
  Event,
  EventStatistics,
  GetCombinedLeaderboardCommand,
  GetCombinedLeaderboardCommandInput,
  GetCombinedLeaderboardCommandOutput,
  GetEventCommand,
  GetEventCommandInput,
  GetEventCommandOutput,
  GetEventStatisticsCommand,
  GetEventStatisticsCommandInput,
  GetEventStatisticsCommandOutput,
  Leaderboard,
  ListEventsCommandInput,
  ListEventTracksCommandInput,
  paginateListEvents,
  paginateListEventTracks,
  RemoveTrackFromEventCommand,
  RemoveTrackFromEventCommandInput,
  TransitionEventStatusCommand,
  TransitionEventStatusCommandInput,
  TransitionEventStatusCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

/**
 * Tag-computation helpers, exported so tests can bind directly to the same logic
 * used by the endpoint definitions below, rather than re-declaring local copies
 * that could silently drift from the shipping code.
 */
export const listEventsProvidesTags = (result: Event[] = []) => [
  ...result.map(({ eventId }) => ({
    type: DeepRacerApiQueryTagType.EVENTS,
    id: eventId,
  })),
  { type: DeepRacerApiQueryTagType.EVENTS, id: LIST_QUERY_TAG_ID },
];

export const getEventProvidesTags = (eventId: string) => [{ type: DeepRacerApiQueryTagType.EVENTS, id: eventId }];

export const eventAndListInvalidatesTags = (eventId: string) => [
  { type: DeepRacerApiQueryTagType.EVENTS, id: eventId },
  { type: DeepRacerApiQueryTagType.EVENTS, id: LIST_QUERY_TAG_ID },
];

export const getEventStatisticsProvidesTags = (eventId: string) => [
  { type: DeepRacerApiQueryTagType.EVENTS, id: `${eventId}-statistics` },
];

export const listEventTracksProvidesTags = (eventId: string) => [
  { type: DeepRacerApiQueryTagType.EVENTS, id: `${eventId}-tracks` },
];

export const getCombinedLeaderboardProvidesTags = (eventId: string) => [
  { type: DeepRacerApiQueryTagType.EVENTS, id: `${eventId}-combined-leaderboard` },
];

export const eventTracksAndCombinedLeaderboardInvalidatesTags = (eventId: string) => [
  { type: DeepRacerApiQueryTagType.EVENTS, id: `${eventId}-tracks` },
  { type: DeepRacerApiQueryTagType.EVENTS, id: `${eventId}-combined-leaderboard` },
];

export const eventsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listEvents: build.query<Event[], ListEventsCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListEvents, dispatch, 'events'),
      providesTags: (result) => listEventsProvidesTags(result),
    }),
    getEvent: build.query<Event, GetEventCommandInput>({
      query: (input) => ({
        command: new GetEventCommand(input),
      }),
      transformResponse: (response: GetEventCommandOutput) => response.event,
      providesTags: (_result, _meta, { eventId }) => getEventProvidesTags(eventId),
    }),
    createEvent: build.mutation<string, CreateEventCommandInput>({
      query: (input) => ({
        command: new CreateEventCommand(input),
      }),
      transformResponse: (response: CreateEventCommandOutput) => response.eventId,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.EVENTS, id: LIST_QUERY_TAG_ID }],
    }),
    editEvent: build.mutation<Event, EditEventCommandInput>({
      query: (input) => ({
        command: new EditEventCommand(input),
      }),
      transformResponse: (response: EditEventCommandOutput) => response.event,
      invalidatesTags: (_result, _meta, { eventId }) => eventAndListInvalidatesTags(eventId),
    }),
    deleteEvent: build.mutation<void, DeleteEventCommandInput>({
      query: (input) => ({
        command: new DeleteEventCommand(input),
      }),
      invalidatesTags: (_result, _meta, { eventId }) => eventAndListInvalidatesTags(eventId),
    }),
    transitionEventStatus: build.mutation<TransitionEventStatusCommandOutput, TransitionEventStatusCommandInput>({
      query: (input) => ({
        command: new TransitionEventStatusCommand(input),
      }),
      invalidatesTags: (_result, _meta, { eventId }) => eventAndListInvalidatesTags(eventId),
    }),
    getEventStatistics: build.query<EventStatistics, GetEventStatisticsCommandInput>({
      query: (input) => ({
        command: new GetEventStatisticsCommand(input),
      }),
      transformResponse: (response: GetEventStatisticsCommandOutput) => response.statistics,
      providesTags: (_result, _meta, { eventId }) => getEventStatisticsProvidesTags(eventId),
    }),
    listEventTracks: build.query<Leaderboard[], ListEventTracksCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListEventTracks, dispatch, 'tracks'),
      providesTags: (_result, _meta, { eventId }) => listEventTracksProvidesTags(eventId),
    }),
    addTrackToEvent: build.mutation<AddTrackToEventCommandOutput, AddTrackToEventCommandInput>({
      query: (input) => ({
        command: new AddTrackToEventCommand(input),
      }),
      invalidatesTags: (_result, _meta, { eventId }) => eventTracksAndCombinedLeaderboardInvalidatesTags(eventId),
    }),
    removeTrackFromEvent: build.mutation<void, RemoveTrackFromEventCommandInput>({
      query: (input) => ({
        command: new RemoveTrackFromEventCommand(input),
      }),
      invalidatesTags: (_result, _meta, { eventId }) => eventTracksAndCombinedLeaderboardInvalidatesTags(eventId),
    }),
    getCombinedLeaderboard: build.query<GetCombinedLeaderboardCommandOutput, GetCombinedLeaderboardCommandInput>({
      query: (input) => ({
        command: new GetCombinedLeaderboardCommand(input),
      }),
      providesTags: (_result, _meta, { eventId }) => getCombinedLeaderboardProvidesTags(eventId),
    }),
  }),
});

export const {
  useListEventsQuery,
  useGetEventQuery,
  useCreateEventMutation,
  useEditEventMutation,
  useDeleteEventMutation,
  useTransitionEventStatusMutation,
  useGetEventStatisticsQuery,
  useListEventTracksQuery,
  useAddTrackToEventMutation,
  useRemoveTrackFromEventMutation,
  useGetCombinedLeaderboardQuery,
} = eventsApi;
