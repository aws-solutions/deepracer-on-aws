// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateRunCommand,
  GetRunCommand,
  Lap,
  ListRunsCommand,
  Run,
  RunStatus,
  RunTransitionAction,
  SetLapValidityCommand,
  TransitionRunStatusCommand,
  UpdateLapCommand,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from '#services/deepRacer/constants';
import {
  getRunProvidesTags,
  listRunsProvidesTags,
  runAndListInvalidatesTags,
  runsApi,
} from '#services/deepRacer/runsApi';
import notificationsSlice from '#store/notifications/notificationsSlice';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockRun: Run = {
  runId: 'run-001',
  leaderboardId: 'lb-001',
  eventId: 'evt-001',
  profileId: 'profile-001',
  runStatus: RunStatus.FINISHED,
  createdAt: new Date('2026-09-15T10:00:00Z'),
  updatedAt: new Date('2026-09-15T10:00:00Z'),
};

const mockLap: Lap = {
  runId: 'run-001',
  leaderboardId: 'lb-001',
  lapNumber: 1,
  lapTimeMs: 11230,
  isValid: true,
  resets: 0,
  createdAt: new Date('2026-09-15T10:01:00Z'),
  updatedAt: new Date('2026-09-15T10:01:00Z'),
};

describe('runsApi', () => {
  const store = configureStore({
    reducer: {
      [runsApi.reducerPath]: runsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(runsApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(runsApi.util.resetApiState());
  });

  describe('getRun query', () => {
    it('sends a GetRunCommand and transforms the response to { run, laps }', async () => {
      mockDeepRacerClient.on(GetRunCommand).resolvesOnce({ run: mockRun, laps: [mockLap] });

      const result = await store
        .dispatch(runsApi.endpoints.getRun.initiate({ eventId: 'evt-001', leaderboardId: 'lb-001', runId: 'run-001' }))
        .unwrap();

      expect(result).toEqual({ run: mockRun, laps: [mockLap] });
      expect(mockDeepRacerClient.commandCalls(GetRunCommand)).toHaveLength(1);
    });

    it('propagates errors from the client', async () => {
      mockDeepRacerClient
        .on(GetRunCommand)
        .rejectsOnce(Object.assign(new Error('Not found'), { name: 'NotFoundError' }));

      const result = await store.dispatch(
        runsApi.endpoints.getRun.initiate({ eventId: 'evt-001', leaderboardId: 'lb-001', runId: 'missing' }),
      );

      expect(result.error).toBeDefined();
    });
  });

  describe('createRun mutation', () => {
    it('sends a CreateRunCommand and transforms the response to the run', async () => {
      mockDeepRacerClient.on(CreateRunCommand).resolvesOnce({ run: mockRun });

      const result = await store
        .dispatch(
          runsApi.endpoints.createRun.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            profileId: 'profile-001',
          }),
        )
        .unwrap();

      expect(result).toEqual(mockRun);
      expect(mockDeepRacerClient.commandCalls(CreateRunCommand)).toHaveLength(1);
    });
  });

  describe('transitionRunStatus mutation', () => {
    it('sends a TransitionRunStatusCommand with the given action', async () => {
      mockDeepRacerClient
        .on(TransitionRunStatusCommand)
        .resolvesOnce({ run: { ...mockRun, runStatus: RunStatus.IN_PROGRESS } });

      await store
        .dispatch(
          runsApi.endpoints.transitionRunStatus.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            runId: 'run-001',
            action: RunTransitionAction.START,
          }),
        )
        .unwrap();

      const calls = mockDeepRacerClient.commandCalls(TransitionRunStatusCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({
        eventId: 'evt-001',
        leaderboardId: 'lb-001',
        runId: 'run-001',
        action: RunTransitionAction.START,
      });
    });
  });

  describe('listRuns query', () => {
    it('paginates through ListRunsCommand pages and returns the flattened runs', async () => {
      mockDeepRacerClient
        .on(ListRunsCommand)
        .resolvesOnce({ runs: [mockRun], token: 'token-1' })
        .resolvesOnce({ runs: [{ ...mockRun, runId: 'run-002' }] });

      const result = await store
        .dispatch(runsApi.endpoints.listRuns.initiate({ eventId: 'evt-001', leaderboardId: 'lb-001' }))
        .unwrap();

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.runId)).toEqual(['run-001', 'run-002']);
    });
  });

  describe('updateLap mutation', () => {
    it('sends an UpdateLapCommand with the given input', async () => {
      const updatedLap = { ...mockLap, lapTimeMs: 11050, originalLapTimeMs: 11230, editReason: 'glitch' };
      mockDeepRacerClient.on(UpdateLapCommand).resolvesOnce({ lap: updatedLap });

      const result = await store
        .dispatch(
          runsApi.endpoints.updateLap.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            runId: 'run-001',
            lapNumber: 1,
            lapTimeMs: 11050,
            editReason: 'glitch',
          }),
        )
        .unwrap();

      expect(result).toEqual({ lap: updatedLap });
      const calls = mockDeepRacerClient.commandCalls(UpdateLapCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({
        eventId: 'evt-001',
        leaderboardId: 'lb-001',
        runId: 'run-001',
        lapNumber: 1,
        lapTimeMs: 11050,
        editReason: 'glitch',
      });
    });

    it('propagates errors from the client', async () => {
      mockDeepRacerClient
        .on(UpdateLapCommand)
        .rejectsOnce(Object.assign(new Error('Not authorized'), { name: 'NotAuthorizedError' }));

      const result = await store.dispatch(
        runsApi.endpoints.updateLap.initiate({
          eventId: 'evt-001',
          leaderboardId: 'lb-001',
          runId: 'run-001',
          lapNumber: 1,
          lapTimeMs: 11050,
          editReason: 'glitch',
        }),
      );

      expect(result.error).toBeDefined();
    });
  });

  describe('setLapValidity mutation', () => {
    it('sends a SetLapValidityCommand with the given input', async () => {
      mockDeepRacerClient.on(SetLapValidityCommand).resolvesOnce({ lap: { ...mockLap, isValid: false } });

      const result = await store
        .dispatch(
          runsApi.endpoints.setLapValidity.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            runId: 'run-001',
            lapNumber: 1,
            isValid: false,
          }),
        )
        .unwrap();

      expect(result).toEqual({ lap: { ...mockLap, isValid: false } });
    });
  });

  describe('exported hooks', () => {
    it('exports all mutation and query hooks', () => {
      expect(runsApi.useListRunsQuery).toBeDefined();
      expect(runsApi.useGetRunQuery).toBeDefined();
      expect(runsApi.useCreateRunMutation).toBeDefined();
      expect(runsApi.useTransitionRunStatusMutation).toBeDefined();
      expect(runsApi.useUpdateLapMutation).toBeDefined();
      expect(runsApi.useSetLapValidityMutation).toBeDefined();
    });
  });

  describe('listRunsProvidesTags', () => {
    it('returns a tag per run plus a list tag scoped to the leaderboard', () => {
      const tags = listRunsProvidesTags('lb-001', [mockRun]);
      expect(tags).toEqual([
        { type: DeepRacerApiQueryTagType.RUNS, id: 'run-001' },
        { type: DeepRacerApiQueryTagType.RUNS, id: `lb-001-${LIST_QUERY_TAG_ID}` },
      ]);
    });
  });

  describe('getRunProvidesTags', () => {
    it('returns RUNS and LAPS tags scoped to the runId', () => {
      expect(getRunProvidesTags('run-001')).toEqual([
        { type: DeepRacerApiQueryTagType.RUNS, id: 'run-001' },
        { type: DeepRacerApiQueryTagType.LAPS, id: 'run-001' },
      ]);
    });
  });

  describe('runAndListInvalidatesTags', () => {
    it('returns the run tag and the leaderboard-scoped list tag', () => {
      const tags = runAndListInvalidatesTags('run-001', 'lb-001');
      expect(tags).toEqual([
        { type: DeepRacerApiQueryTagType.RUNS, id: 'run-001' },
        { type: DeepRacerApiQueryTagType.RUNS, id: `lb-001-${LIST_QUERY_TAG_ID}` },
      ]);
    });
  });

  describe('error notification opt-out', () => {
    // getRun and updateLap have component-level error handling (RunLapsPanel's inline "not
    // found" alert and its own error toast on a failed edit) — the base query's automatic
    // toast must be suppressed to avoid a duplicate notification. setLapValidity follows the
    // same lap-mutation pattern for consistency with updateLap.
    const storeWithNotifications = configureStore({
      reducer: {
        [runsApi.reducerPath]: runsApi.reducer,
        notifications: notificationsSlice.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(runsApi.middleware),
    });

    beforeEach(() => {
      mockDeepRacerClient.reset();
      storeWithNotifications.dispatch(runsApi.util.resetApiState());
    });

    it('does not dispatch an error notification when getRun fails', async () => {
      mockDeepRacerClient.on(GetRunCommand).rejectsOnce(new Error('Not found'));

      await storeWithNotifications.dispatch(
        runsApi.endpoints.getRun.initiate({ eventId: 'evt-001', leaderboardId: 'lb-001', runId: 'missing' }),
      );

      expect(storeWithNotifications.getState().notifications.items).toHaveLength(0);
    });

    it('does not dispatch an error notification when updateLap fails', async () => {
      mockDeepRacerClient.on(UpdateLapCommand).rejectsOnce(new Error('Not authorized'));

      await storeWithNotifications.dispatch(
        runsApi.endpoints.updateLap.initiate({
          eventId: 'evt-001',
          leaderboardId: 'lb-001',
          runId: 'run-001',
          lapNumber: 1,
          lapTimeMs: 11050,
          editReason: 'glitch',
        }),
      );

      expect(storeWithNotifications.getState().notifications.items).toHaveLength(0);
    });

    it('does not dispatch an error notification when setLapValidity fails', async () => {
      mockDeepRacerClient.on(SetLapValidityCommand).rejectsOnce(new Error('Not authorized'));

      await storeWithNotifications.dispatch(
        runsApi.endpoints.setLapValidity.initiate({
          eventId: 'evt-001',
          leaderboardId: 'lb-001',
          runId: 'run-001',
          lapNumber: 1,
          isValid: false,
        }),
      );

      expect(storeWithNotifications.getState().notifications.items).toHaveLength(0);
    });
  });
});
