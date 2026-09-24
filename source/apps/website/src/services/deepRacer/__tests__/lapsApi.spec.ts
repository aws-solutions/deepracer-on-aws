// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CreateLapCommand, Lap, SetLapValidityCommand, UpdateLapCommand } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeepRacerApiQueryTagType } from '#services/deepRacer/constants';
import { lapMutationInvalidatesTags, lapsApi } from '#services/deepRacer/lapsApi';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockLap: Lap = {
  runId: 'run-001',
  leaderboardId: 'lb-001',
  lapNumber: 1,
  lapTimeMs: 12450,
  isValid: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('lapsApi', () => {
  const store = configureStore({
    reducer: {
      [lapsApi.reducerPath]: lapsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(lapsApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(lapsApi.util.resetApiState());
  });

  describe('createLap mutation', () => {
    it('sends a CreateLapCommand and transforms the response to the lap', async () => {
      mockDeepRacerClient.on(CreateLapCommand).resolvesOnce({ lap: mockLap });

      const result = await store
        .dispatch(
          lapsApi.endpoints.createLap.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            runId: 'run-001',
            lapTimeMs: 12450,
          }),
        )
        .unwrap();

      expect(result).toEqual(mockLap);
      expect(mockDeepRacerClient.commandCalls(CreateLapCommand)).toHaveLength(1);
    });
  });

  describe('setLapValidity mutation', () => {
    it('sends a SetLapValidityCommand with the given isValid flag', async () => {
      mockDeepRacerClient.on(SetLapValidityCommand).resolvesOnce({ lap: { ...mockLap, isValid: false } });

      await store
        .dispatch(
          lapsApi.endpoints.setLapValidity.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            runId: 'run-001',
            lapNumber: 1,
            isValid: false,
          }),
        )
        .unwrap();

      const calls = mockDeepRacerClient.commandCalls(SetLapValidityCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({
        eventId: 'evt-001',
        leaderboardId: 'lb-001',
        runId: 'run-001',
        lapNumber: 1,
        isValid: false,
      });
    });
  });

  describe('updateLap mutation', () => {
    it('sends an UpdateLapCommand with the corrected lap time and edit reason', async () => {
      mockDeepRacerClient.on(UpdateLapCommand).resolvesOnce({ lap: { ...mockLap, lapTimeMs: 11050 } });

      await store
        .dispatch(
          lapsApi.endpoints.updateLap.initiate({
            eventId: 'evt-001',
            leaderboardId: 'lb-001',
            runId: 'run-001',
            lapNumber: 1,
            lapTimeMs: 11050,
            editReason: 'Timer double-triggered',
          }),
        )
        .unwrap();

      expect(mockDeepRacerClient.commandCalls(UpdateLapCommand)).toHaveLength(1);
    });
  });

  describe('exported hooks', () => {
    it('exports all mutation hooks', () => {
      expect(lapsApi.useCreateLapMutation).toBeDefined();
      expect(lapsApi.useSetLapValidityMutation).toBeDefined();
      expect(lapsApi.useUpdateLapMutation).toBeDefined();
    });
  });

  describe('lapMutationInvalidatesTags', () => {
    it('returns a tag scoped to the parent run so GetRun refetches with updated laps', () => {
      expect(lapMutationInvalidatesTags('run-001')).toEqual([{ type: DeepRacerApiQueryTagType.LAPS, id: 'run-001' }]);
    });
  });
});
