// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ActivateDeviceCommand,
  BatchUpdateDeviceCommand,
  ChangeDeviceColorCommand,
  ClearDeviceModelsCommand,
  DeleteDeviceCommand,
  Device,
  DeviceColor,
  DeviceStatus,
  DeviceType,
  ListDevicesCommand,
  ListEventDevicesCommand,
  RestartDeviceCommand,
  StopDeviceCommand,
  UpdateDeviceCommand,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from '#services/deepRacer/constants';
import { deviceAndListInvalidatesTags, devicesApi, listDevicesProvidesTags } from '#services/deepRacer/devicesApi';
import { mockDeepRacerClient } from '#utils/testUtils';

const mockDevice: Device = {
  instanceId: 'mi-0123456789abcdef0',
  name: 'Car One',
  deviceType: DeviceType.CAR,
  status: DeviceStatus.ONLINE,
  activatedAt: new Date('2026-01-01'),
};

describe('devicesApi', () => {
  const store = configureStore({
    reducer: { [devicesApi.reducerPath]: devicesApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(devicesApi.middleware),
  });

  beforeEach(() => {
    mockDeepRacerClient.reset();
    store.dispatch(devicesApi.util.resetApiState());
  });

  describe('listDevices query', () => {
    it('paginates ListDevices and returns the devices array', async () => {
      mockDeepRacerClient.on(ListDevicesCommand).resolvesOnce({ devices: [mockDevice] });

      const result = await store.dispatch(devicesApi.endpoints.listDevices.initiate({})).unwrap();

      expect(result).toEqual([mockDevice]);
      expect(mockDeepRacerClient.commandCalls(ListDevicesCommand)).toHaveLength(1);
    });
  });

  describe('listEventDevices query', () => {
    it('paginates ListEventDevices and returns the devices array', async () => {
      mockDeepRacerClient.on(ListEventDevicesCommand).resolvesOnce({ devices: [mockDevice] });

      const result = await store
        .dispatch(devicesApi.endpoints.listEventDevices.initiate({ eventId: 'evt-1' }))
        .unwrap();

      expect(result).toEqual([mockDevice]);
      expect(mockDeepRacerClient.commandCalls(ListEventDevicesCommand)).toHaveLength(1);
    });
  });

  describe('mutations', () => {
    it('restartDevice sends a RestartDeviceCommand and returns the commandId', async () => {
      mockDeepRacerClient.on(RestartDeviceCommand).resolvesOnce({ commandId: 'cmd-1' });

      const result = await store
        .dispatch(devicesApi.endpoints.restartDevice.initiate({ instanceId: mockDevice.instanceId }))
        .unwrap();

      expect(result.commandId).toBe('cmd-1');
    });

    it('stopDevice sends a StopDeviceCommand and returns the commandId', async () => {
      mockDeepRacerClient.on(StopDeviceCommand).resolvesOnce({ commandId: 'cmd-2' });

      const result = await store
        .dispatch(devicesApi.endpoints.stopDevice.initiate({ instanceId: mockDevice.instanceId }))
        .unwrap();

      expect(result.commandId).toBe('cmd-2');
    });

    it('changeDeviceColor sends a ChangeDeviceColorCommand', async () => {
      mockDeepRacerClient.on(ChangeDeviceColorCommand).resolvesOnce({});

      await store
        .dispatch(
          devicesApi.endpoints.changeDeviceColor.initiate({
            instanceId: mockDevice.instanceId,
            color: DeviceColor.RED,
          }),
        )
        .unwrap();

      expect(mockDeepRacerClient.commandCalls(ChangeDeviceColorCommand)).toHaveLength(1);
    });

    it('deleteDevice sends a DeleteDeviceCommand', async () => {
      mockDeepRacerClient.on(DeleteDeviceCommand).resolvesOnce({});

      await store.dispatch(devicesApi.endpoints.deleteDevice.initiate({ instanceId: mockDevice.instanceId })).unwrap();

      expect(mockDeepRacerClient.commandCalls(DeleteDeviceCommand)).toHaveLength(1);
    });

    it('activateDevice sends an ActivateDeviceCommand and returns the activation', async () => {
      mockDeepRacerClient.on(ActivateDeviceCommand).resolvesOnce({
        activationId: 'act-1',
        activationCode: 'code-1',
        region: 'us-east-1',
        expiresAt: new Date('2026-12-31'),
      });

      const result = await store
        .dispatch(devicesApi.endpoints.activateDevice.initiate({ name: 'car-01', deviceType: DeviceType.CAR }))
        .unwrap();

      expect(result.activationId).toBe('act-1');
      expect(mockDeepRacerClient.commandCalls(ActivateDeviceCommand)).toHaveLength(1);
    });

    it('updateDevice sends an UpdateDeviceCommand and returns the transformed device', async () => {
      const updated = { ...mockDevice, fleetId: 'FLEET0000000001' };
      mockDeepRacerClient.on(UpdateDeviceCommand).resolvesOnce({ device: updated });

      const result = await store
        .dispatch(
          devicesApi.endpoints.updateDevice.initiate({ instanceId: mockDevice.instanceId, fleetId: 'FLEET0000000001' }),
        )
        .unwrap();

      expect(result?.fleetId).toBe('FLEET0000000001');
    });

    it('batchUpdateDevice sends a BatchUpdateDeviceCommand and returns assigned ids and errors', async () => {
      mockDeepRacerClient
        .on(BatchUpdateDeviceCommand)
        .resolvesOnce({ assignedInstanceIds: [mockDevice.instanceId], errors: [] });

      const result = await store
        .dispatch(
          devicesApi.endpoints.batchUpdateDevice.initiate({
            instanceIds: [mockDevice.instanceId],
            fleetId: 'FLEET0000000001',
          }),
        )
        .unwrap();

      expect(result.assignedInstanceIds).toEqual([mockDevice.instanceId]);
      expect(result.errors).toEqual([]);
    });

    it('clearDeviceModels sends a ClearDeviceModelsCommand and returns the commandId', async () => {
      mockDeepRacerClient.on(ClearDeviceModelsCommand).resolvesOnce({ commandId: 'cmd-abc123' });

      const result = await store
        .dispatch(devicesApi.endpoints.clearDeviceModels.initiate({ instanceId: mockDevice.instanceId }))
        .unwrap();

      expect(result.commandId).toBe('cmd-abc123');
      expect(mockDeepRacerClient.commandCalls(ClearDeviceModelsCommand)).toHaveLength(1);
    });

    it('clearDeviceModels propagates errors from the client', async () => {
      mockDeepRacerClient
        .on(ClearDeviceModelsCommand)
        .rejectsOnce(Object.assign(new Error('Device not found'), { name: 'NotFoundError' }));

      const result = await store.dispatch(
        devicesApi.endpoints.clearDeviceModels.initiate({ instanceId: 'mi-missing' }),
      );

      expect(result.error).toBeDefined();
    });
  });

  describe('tag helpers', () => {
    it('listDevicesProvidesTags tags each device plus the list', () => {
      expect(listDevicesProvidesTags([mockDevice])).toEqual([
        { type: DeepRacerApiQueryTagType.DEVICES, id: mockDevice.instanceId },
        { type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID },
      ]);
    });

    it('deviceAndListInvalidatesTags targets the device and the list', () => {
      expect(deviceAndListInvalidatesTags('mi-x')).toEqual([
        { type: DeepRacerApiQueryTagType.DEVICES, id: 'mi-x' },
        { type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID },
      ]);
    });
  });
});
