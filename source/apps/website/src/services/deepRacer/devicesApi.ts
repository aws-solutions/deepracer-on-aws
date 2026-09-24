// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ActivateDeviceCommand,
  ActivateDeviceCommandInput,
  ActivateDeviceCommandOutput,
  BatchUpdateDeviceCommand,
  BatchUpdateDeviceCommandInput,
  BatchUpdateDeviceCommandOutput,
  ChangeDeviceColorCommand,
  ChangeDeviceColorCommandInput,
  ClearDeviceModelsCommand,
  ClearDeviceModelsCommandInput,
  DeleteDeviceCommand,
  DeleteDeviceCommandInput,
  Device,
  ListDevicesCommandInput,
  ListEventDevicesCommandInput,
  paginateListDevices,
  paginateListEventDevices,
  RestartDeviceCommand,
  RestartDeviceCommandInput,
  RestartDeviceCommandOutput,
  StopDeviceCommand,
  StopDeviceCommandInput,
  StopDeviceCommandOutput,
  UpdateDeviceCommand,
  UpdateDeviceCommandInput,
  UpdateDeviceCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

/**
 * Tag helpers, exported so tests bind to the same logic the endpoints use rather than
 * re-declaring copies that could drift (mirrors eventsApi).
 */
export const listDevicesProvidesTags = (result: Device[] = []) => [
  ...result.map(({ instanceId }) => ({ type: DeepRacerApiQueryTagType.DEVICES, id: instanceId })),
  { type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID },
];

export const deviceAndListInvalidatesTags = (instanceId: string) => [
  { type: DeepRacerApiQueryTagType.DEVICES, id: instanceId },
  { type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID },
];

const deviceListInvalidatesTags = [{ type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID }];

export const devicesApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listDevices: build.query<Device[], ListDevicesCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListDevices, dispatch, 'devices'),
      providesTags: (result) => listDevicesProvidesTags(result),
    }),
    listEventDevices: build.query<Device[], ListEventDevicesCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListEventDevices, dispatch, 'devices'),
      providesTags: (result) => listDevicesProvidesTags(result),
    }),
    activateDevice: build.mutation<ActivateDeviceCommandOutput, ActivateDeviceCommandInput>({
      query: (input) => ({ command: new ActivateDeviceCommand(input) }),
      invalidatesTags: deviceListInvalidatesTags,
    }),
    restartDevice: build.mutation<RestartDeviceCommandOutput, RestartDeviceCommandInput>({
      query: (input) => ({ command: new RestartDeviceCommand(input) }),
      invalidatesTags: (_result, _meta, { instanceId }) => deviceAndListInvalidatesTags(instanceId),
    }),
    stopDevice: build.mutation<StopDeviceCommandOutput, StopDeviceCommandInput>({
      query: (input) => ({ command: new StopDeviceCommand(input) }),
      invalidatesTags: (_result, _meta, { instanceId }) => deviceAndListInvalidatesTags(instanceId),
    }),
    changeDeviceColor: build.mutation<void, ChangeDeviceColorCommandInput>({
      query: (input) => ({ command: new ChangeDeviceColorCommand(input) }),
      invalidatesTags: (_result, _meta, { instanceId }) => deviceAndListInvalidatesTags(instanceId),
    }),
    deleteDevice: build.mutation<void, DeleteDeviceCommandInput>({
      query: (input) => ({ command: new DeleteDeviceCommand(input) }),
      invalidatesTags: (_result, _meta, { instanceId }) => deviceAndListInvalidatesTags(instanceId),
    }),
    clearDeviceModels: build.mutation<{ commandId: string }, ClearDeviceModelsCommandInput>({
      query: (input) => ({ command: new ClearDeviceModelsCommand(input), displayNotificationOnError: false }),
    }),
    updateDevice: build.mutation<Device | undefined, UpdateDeviceCommandInput>({
      query: (input) => ({ command: new UpdateDeviceCommand(input) }),
      transformResponse: (response: UpdateDeviceCommandOutput) => response.device,
      // Reassigning a fleet changes both the device and per-fleet device counts.
      invalidatesTags: (_result, _meta, { instanceId }) => [
        ...deviceAndListInvalidatesTags(instanceId),
        { type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID },
      ],
    }),
    batchUpdateDevice: build.mutation<BatchUpdateDeviceCommandOutput, BatchUpdateDeviceCommandInput>({
      query: (input) => ({ command: new BatchUpdateDeviceCommand(input) }),
      // Bulk reassignment touches many devices and per-fleet counts — invalidate both lists.
      invalidatesTags: [
        { type: DeepRacerApiQueryTagType.DEVICES, id: LIST_QUERY_TAG_ID },
        { type: DeepRacerApiQueryTagType.FLEETS, id: LIST_QUERY_TAG_ID },
      ],
    }),
  }),
});

export const {
  useListDevicesQuery,
  useListEventDevicesQuery,
  useActivateDeviceMutation,
  useRestartDeviceMutation,
  useStopDeviceMutation,
  useChangeDeviceColorMutation,
  useDeleteDeviceMutation,
  useClearDeviceModelsMutation,
  useUpdateDeviceMutation,
  useBatchUpdateDeviceMutation,
} = devicesApi;
