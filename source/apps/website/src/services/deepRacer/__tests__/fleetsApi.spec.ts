// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AssignEventFleetsCommand,
  CreateFleetCommand,
  DeleteFleetCommand,
  Fleet,
  ListFleetsCommand,
  UpdateFleetCommand,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from '#services/deepRacer/constants';
import { fleetsApi, listFleetsProvidesTags } from '#services/deepRacer/fleetsApi';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockFleet: Fleet = {
  fleetId: 'FLEET0000000001',
  name: 'London',
  createdAt: new Date('2026-01-01'),
};

describe('fleetsApi', () => {
  const store = configureStore({
    reducer: { [fleetsApi.reducerPath]: fleetsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(fleetsApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(fleetsApi.util.resetApiState());
  });

  it('listFleets paginates and returns the fleets array', async () => {
    mockDeepRacerClient.on(ListFleetsCommand).resolvesOnce({ fleets: [mockFleet] });

    const result = await store.dispatch(fleetsApi.endpoints.listFleets.initiate({})).unwrap();

    expect(result).toEqual([mockFleet]);
    expect(mockDeepRacerClient.commandCalls(ListFleetsCommand)).toHaveLength(1);
  });

  it('createFleet transforms the response to the fleetId', async () => {
    mockDeepRacerClient.on(CreateFleetCommand).resolvesOnce({ fleetId: 'FLEET0000000002' });

    const result = await store
      .dispatch(fleetsApi.endpoints.createFleet.initiate({ fleetDefinition: { name: 'Paris' } }))
      .unwrap();

    expect(result).toBe('FLEET0000000002');
  });

  it('updateFleet transforms the response to the fleet', async () => {
    mockDeepRacerClient.on(UpdateFleetCommand).resolvesOnce({ fleet: { ...mockFleet, name: 'Paris' } });

    const result = await store
      .dispatch(fleetsApi.endpoints.updateFleet.initiate({ fleetId: mockFleet.fleetId, name: 'Paris' }))
      .unwrap();

    expect(result?.name).toBe('Paris');
  });

  it('deleteFleet sends a DeleteFleetCommand', async () => {
    mockDeepRacerClient.on(DeleteFleetCommand).resolvesOnce({});
    await store.dispatch(fleetsApi.endpoints.deleteFleet.initiate({ fleetId: mockFleet.fleetId })).unwrap();
    expect(mockDeepRacerClient.commandCalls(DeleteFleetCommand)).toHaveLength(1);
  });

  it('assignEventFleets sends an AssignEventFleetsCommand', async () => {
    mockDeepRacerClient.on(AssignEventFleetsCommand).resolvesOnce({ assignedFleetIds: ['FLEET0000000001'] });
    const result = await store
      .dispatch(fleetsApi.endpoints.assignEventFleets.initiate({ eventId: 'evt-1', fleetIds: ['FLEET0000000001'] }))
      .unwrap();
    expect(result.assignedFleetIds).toEqual(['FLEET0000000001']);
  });

  it('listFleetsProvidesTags tags each fleet plus the list', () => {
    expect(listFleetsProvidesTags([mockFleet])).toEqual([
      { type: DeepRacerApiQueryTagType.FLEETS, id: mockFleet.fleetId },
      { type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID },
    ]);
  });
});
