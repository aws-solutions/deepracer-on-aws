// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AddTrackToEventCommand,
  CreateEventCommand,
  DeleteEventCommand,
  EditEventCommand,
  Event,
  EventStatus,
  EventTransitionAction,
  EventType,
  GetCombinedLeaderboardCommand,
  GetEventCommand,
  Leaderboard,
  ListEventsCommand,
  ListEventTracksCommand,
  RaceFormat,
  RaceType,
  RemoveTrackFromEventCommand,
  TimingMethod,
  TrackDirection,
  TrackId,
  TransitionEventStatusCommand,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeepRacerApiQueryTagType } from '#services/deepRacer/constants';
import {
  eventsApi,
  eventTracksAndCombinedLeaderboardInvalidatesTags,
  getEventStatisticsProvidesTags,
} from '#services/deepRacer/eventsApi';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockEvent: Event = {
  eventId: 'evt-001',
  name: 're:Invent 2025',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2025-12-01',
  countryCode: 'US',
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: 5,
  maxTimeInMinutes: 3,
  maxResets: 3,
  eventStatus: EventStatus.DRAFT,
  createdBy: 'TestAdmin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('eventsApi', () => {
  const store = configureStore({
    reducer: {
      [eventsApi.reducerPath]: eventsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(eventsApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(eventsApi.util.resetApiState());
  });

  describe('getEvent query', () => {
    it('sends a GetEventCommand and transforms the response to the event', async () => {
      mockDeepRacerClient.on(GetEventCommand).resolvesOnce({ event: mockEvent });

      const result = await store.dispatch(eventsApi.endpoints.getEvent.initiate({ eventId: 'evt-001' })).unwrap();

      expect(result).toEqual(mockEvent);
      expect(mockDeepRacerClient.commandCalls(GetEventCommand)).toHaveLength(1);
    });

    it('propagates errors from the client', async () => {
      mockDeepRacerClient
        .on(GetEventCommand)
        .rejectsOnce(Object.assign(new Error('Not found'), { name: 'NotFoundError' }));

      const result = await store.dispatch(eventsApi.endpoints.getEvent.initiate({ eventId: 'missing' }));

      expect(result.error).toBeDefined();
    });
  });

  describe('createEvent mutation', () => {
    it('sends a CreateEventCommand and transforms the response to the eventId', async () => {
      mockDeepRacerClient.on(CreateEventCommand).resolvesOnce({ eventId: 'evt-new' });

      const result = await store
        .dispatch(
          eventsApi.endpoints.createEvent.initiate({
            eventDefinition: {
              name: 'New Event',
              eventType: EventType.AWS_SUMMIT,
              eventDate: '2026-01-01',
              countryCode: 'US',
              raceFormat: RaceFormat.BEST_LAP,
              maxLaps: 5,
              maxTimeInMinutes: 3,
              maxResets: 3,
            },
          }),
        )
        .unwrap();

      expect(result).toBe('evt-new');
      expect(mockDeepRacerClient.commandCalls(CreateEventCommand)).toHaveLength(1);
    });
  });

  describe('editEvent mutation', () => {
    it('sends an EditEventCommand and transforms the response to the event', async () => {
      mockDeepRacerClient.on(EditEventCommand).resolvesOnce({ event: mockEvent });

      const result = await store
        .dispatch(
          eventsApi.endpoints.editEvent.initiate({
            eventId: 'evt-001',
            eventDefinition: {
              name: mockEvent.name,
              eventType: mockEvent.eventType,
              eventDate: mockEvent.eventDate,
              countryCode: mockEvent.countryCode,
              raceFormat: mockEvent.raceFormat,
              maxLaps: mockEvent.maxLaps,
              maxTimeInMinutes: mockEvent.maxTimeInMinutes,
              maxResets: mockEvent.maxResets,
            },
          }),
        )
        .unwrap();

      expect(result).toEqual(mockEvent);
      expect(mockDeepRacerClient.commandCalls(EditEventCommand)).toHaveLength(1);
    });
  });

  describe('deleteEvent mutation', () => {
    it('sends a DeleteEventCommand', async () => {
      mockDeepRacerClient.on(DeleteEventCommand).resolvesOnce({});

      await store.dispatch(eventsApi.endpoints.deleteEvent.initiate({ eventId: 'evt-001' })).unwrap();

      expect(mockDeepRacerClient.commandCalls(DeleteEventCommand)).toHaveLength(1);
    });
  });

  describe('transitionEventStatus mutation', () => {
    it('sends a TransitionEventStatusCommand with the given action', async () => {
      mockDeepRacerClient.on(TransitionEventStatusCommand).resolvesOnce({});

      await store
        .dispatch(
          eventsApi.endpoints.transitionEventStatus.initiate({
            eventId: 'evt-001',
            action: EventTransitionAction.OPEN,
          }),
        )
        .unwrap();

      const calls = mockDeepRacerClient.commandCalls(TransitionEventStatusCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({ eventId: 'evt-001', action: EventTransitionAction.OPEN });
    });
  });

  describe('listEvents query', () => {
    it('paginates through ListEventsCommand pages and returns the flattened events', async () => {
      mockDeepRacerClient
        .on(ListEventsCommand)
        .resolvesOnce({ events: [mockEvent], token: 'token-1' })
        .resolvesOnce({ events: [{ ...mockEvent, eventId: 'evt-002' }] });

      const result = await store.dispatch(eventsApi.endpoints.listEvents.initiate({})).unwrap();

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.eventId)).toEqual(['evt-001', 'evt-002']);
    });

    it('provides EVENTS tags for each returned event plus the LIST tag', async () => {
      mockDeepRacerClient.on(ListEventsCommand).resolvesOnce({ events: [mockEvent] });

      await store.dispatch(eventsApi.endpoints.listEvents.initiate({})).unwrap();

      const state = store.getState();
      const cacheEntry = eventsApi.endpoints.listEvents.select({})(state);
      expect(cacheEntry.data).toEqual([mockEvent]);
    });
  });

  describe('cache invalidation', () => {
    it('invalidates the LIST tag after creating an event', async () => {
      mockDeepRacerClient.on(ListEventsCommand).resolves({ events: [mockEvent] });
      mockDeepRacerClient.on(CreateEventCommand).resolvesOnce({ eventId: 'evt-new' });

      await store.dispatch(eventsApi.endpoints.listEvents.initiate({}));
      await store
        .dispatch(
          eventsApi.endpoints.createEvent.initiate({
            eventDefinition: {
              name: 'New Event',
              eventType: EventType.AWS_SUMMIT,
              eventDate: '2026-01-01',
              countryCode: 'US',
              raceFormat: RaceFormat.BEST_LAP,
              maxLaps: 5,
              maxTimeInMinutes: 3,
              maxResets: 3,
            },
          }),
        )
        .unwrap();

      // Creating an event invalidates the LIST tag, which should trigger a refetch
      expect(mockDeepRacerClient.commandCalls(ListEventsCommand).length).toBeGreaterThan(1);
    });

    it('invalidates the specific event tag after editing', async () => {
      mockDeepRacerClient.on(GetEventCommand).resolves({ event: mockEvent });
      mockDeepRacerClient.on(EditEventCommand).resolvesOnce({ event: mockEvent });

      await store.dispatch(eventsApi.endpoints.getEvent.initiate({ eventId: 'evt-001' }));
      await store
        .dispatch(
          eventsApi.endpoints.editEvent.initiate({
            eventId: 'evt-001',
            eventDefinition: {
              name: mockEvent.name,
              eventType: mockEvent.eventType,
              eventDate: mockEvent.eventDate,
              countryCode: mockEvent.countryCode,
              raceFormat: mockEvent.raceFormat,
              maxLaps: mockEvent.maxLaps,
              maxTimeInMinutes: mockEvent.maxTimeInMinutes,
              maxResets: mockEvent.maxResets,
            },
          }),
        )
        .unwrap();

      expect(mockDeepRacerClient.commandCalls(GetEventCommand).length).toBeGreaterThan(1);
    });

    it('invalidates the specific event and LIST tags after deleting', async () => {
      mockDeepRacerClient.on(ListEventsCommand).resolves({ events: [mockEvent] });
      mockDeepRacerClient.on(DeleteEventCommand).resolvesOnce({});

      await store.dispatch(eventsApi.endpoints.listEvents.initiate({}));
      await store.dispatch(eventsApi.endpoints.deleteEvent.initiate({ eventId: 'evt-001' })).unwrap();

      expect(mockDeepRacerClient.commandCalls(ListEventsCommand).length).toBeGreaterThan(1);
    });

    it('invalidates the specific event and LIST tags after a status transition', async () => {
      mockDeepRacerClient.on(ListEventsCommand).resolves({ events: [mockEvent] });
      mockDeepRacerClient.on(TransitionEventStatusCommand).resolvesOnce({});

      await store.dispatch(eventsApi.endpoints.listEvents.initiate({}));
      await store
        .dispatch(
          eventsApi.endpoints.transitionEventStatus.initiate({
            eventId: 'evt-001',
            action: EventTransitionAction.OPEN,
          }),
        )
        .unwrap();

      expect(mockDeepRacerClient.commandCalls(ListEventsCommand).length).toBeGreaterThan(1);
    });
  });

  describe('exported hooks', () => {
    it('exports all mutation and query hooks', () => {
      expect(eventsApi.useListEventsQuery).toBeDefined();
      expect(eventsApi.useGetEventQuery).toBeDefined();
      expect(eventsApi.useCreateEventMutation).toBeDefined();
      expect(eventsApi.useEditEventMutation).toBeDefined();
      expect(eventsApi.useDeleteEventMutation).toBeDefined();
      expect(eventsApi.useTransitionEventStatusMutation).toBeDefined();
    });
  });

  describe('getEventStatisticsProvidesTags', () => {
    it('returns a tag scoped to the event statistics, distinct from the plain event tag', () => {
      const tags = getEventStatisticsProvidesTags('evt-001');
      expect(tags).toEqual([{ type: DeepRacerApiQueryTagType.EVENTS, id: 'evt-001-statistics' }]);
      // Must not collide with the plain event tag used by editEvent/deleteEvent's
      // invalidation, otherwise every event edit would unnecessarily refetch statistics.
      expect(tags[0].id).not.toBe('evt-001');
    });
  });

  describe('listEventTracks query', () => {
    it('paginates through ListEventTracksCommand pages and returns the flattened tracks', async () => {
      const buildTrack = (leaderboardId: string, name: string): Leaderboard => ({
        leaderboardId,
        name,
        openTime: new Date('2026-01-01'),
        closeTime: new Date('2026-01-02'),
        trackConfig: { trackId: TrackId.AWS_SUMMIT_RACEWAY, trackDirection: TrackDirection.CLOCKWISE },
        raceType: RaceType.TIME_TRIAL,
        maxSubmissionsPerUser: 0,
        timingMethod: TimingMethod.BEST_LAP_TIME,
        resettingBehaviorConfig: { continuousLap: true },
        submissionTerminationConditions: { minimumLaps: 1, maximumLaps: 5 },
        participantCount: 0,
      });
      const trackA = buildTrack('lb-001', 'Track A');
      const trackB = buildTrack('lb-002', 'Track B');
      mockDeepRacerClient
        .on(ListEventTracksCommand)
        .resolvesOnce({ tracks: [trackA], nextToken: 'token-1' })
        .resolvesOnce({ tracks: [trackB] });

      const result = await store
        .dispatch(eventsApi.endpoints.listEventTracks.initiate({ eventId: 'evt-001' }))
        .unwrap();

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.leaderboardId)).toEqual(['lb-001', 'lb-002']);
    });
  });

  describe('addTrackToEvent mutation', () => {
    it('sends an AddTrackToEventCommand with the given input', async () => {
      mockDeepRacerClient.on(AddTrackToEventCommand).resolvesOnce({ leaderboardId: 'lb-001' });

      const result = await store
        .dispatch(
          eventsApi.endpoints.addTrackToEvent.initiate({
            eventId: 'evt-001',
            trackType: TrackId.REINVENT_2018,
            leaderBoardTitle: 'Qualifying Track',
          }),
        )
        .unwrap();

      expect(result).toEqual({ leaderboardId: 'lb-001' });
      const calls = mockDeepRacerClient.commandCalls(AddTrackToEventCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({
        eventId: 'evt-001',
        trackType: TrackId.REINVENT_2018,
        leaderBoardTitle: 'Qualifying Track',
      });
    });

    it('invalidates the tracks and combined-leaderboard tags for the event', async () => {
      mockDeepRacerClient.on(ListEventTracksCommand).resolves({ tracks: [] });
      mockDeepRacerClient.on(AddTrackToEventCommand).resolvesOnce({ leaderboardId: 'lb-001' });

      await store.dispatch(eventsApi.endpoints.listEventTracks.initiate({ eventId: 'evt-001' }));
      await store
        .dispatch(
          eventsApi.endpoints.addTrackToEvent.initiate({
            eventId: 'evt-001',
            trackType: TrackId.REINVENT_2018,
            leaderBoardTitle: 'Qualifying Track',
          }),
        )
        .unwrap();

      expect(mockDeepRacerClient.commandCalls(ListEventTracksCommand).length).toBeGreaterThan(1);
    });
  });

  describe('removeTrackFromEvent mutation', () => {
    it('sends a RemoveTrackFromEventCommand with the given input', async () => {
      mockDeepRacerClient.on(RemoveTrackFromEventCommand).resolvesOnce({});

      await store
        .dispatch(eventsApi.endpoints.removeTrackFromEvent.initiate({ eventId: 'evt-001', leaderboardId: 'lb-001' }))
        .unwrap();

      const calls = mockDeepRacerClient.commandCalls(RemoveTrackFromEventCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({ eventId: 'evt-001', leaderboardId: 'lb-001' });
    });

    it('invalidates the tracks and combined-leaderboard tags for the event', async () => {
      mockDeepRacerClient.on(ListEventTracksCommand).resolves({ tracks: [] });
      mockDeepRacerClient.on(RemoveTrackFromEventCommand).resolvesOnce({});

      await store.dispatch(eventsApi.endpoints.listEventTracks.initiate({ eventId: 'evt-001' }));
      await store
        .dispatch(eventsApi.endpoints.removeTrackFromEvent.initiate({ eventId: 'evt-001', leaderboardId: 'lb-001' }))
        .unwrap();

      expect(mockDeepRacerClient.commandCalls(ListEventTracksCommand).length).toBeGreaterThan(1);
    });
  });

  describe('getCombinedLeaderboard query', () => {
    it('sends a GetCombinedLeaderboardCommand and returns the response', async () => {
      const response = {
        combinedScoringStrategy: 'BEST_RESULT_PER_RACER' as const,
        rankings: [],
      };
      mockDeepRacerClient.on(GetCombinedLeaderboardCommand).resolvesOnce(response);

      const result = await store
        .dispatch(eventsApi.endpoints.getCombinedLeaderboard.initiate({ eventId: 'evt-001' }))
        .unwrap();

      expect(result).toEqual(response);
      expect(mockDeepRacerClient.commandCalls(GetCombinedLeaderboardCommand)).toHaveLength(1);
    });
  });

  describe('eventTracksAndCombinedLeaderboardInvalidatesTags', () => {
    it('returns tags scoped to both the tracks list and the combined leaderboard', () => {
      const tags = eventTracksAndCombinedLeaderboardInvalidatesTags('evt-001');
      expect(tags).toEqual([
        { type: DeepRacerApiQueryTagType.EVENTS, id: 'evt-001-tracks' },
        { type: DeepRacerApiQueryTagType.EVENTS, id: 'evt-001-combined-leaderboard' },
      ]);
    });
  });
});
