// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListDevicesCommand, ListFleetsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockDevice, mockDevice2, mockDeviceList, mockFleetList } from '#constants/testConstants.js';

import DeviceDetail from './DeviceDetail';

const meta = {
  component: DeviceDetail,
  title: 'pages/DeviceDetail',
  parameters: {
    routing: {
      componentRoute: '/devices/:instanceId',
    },
  },
} satisfies Meta<typeof DeviceDetail>;

export default meta;

type Story = StoryObj<typeof DeviceDetail>;

// An online car — Restart / Emergency Stop / Change Color / Change Fleet / Delete are all live.
export const OnlineCar: Story = {
  parameters: {
    routing: {
      componentRoute: '/devices/:instanceId',
      initialRouteEntries: [`/devices/${mockDevice.instanceId}`],
    },
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({ devices: mockDeviceList });
      mockClient.on(ListFleetsCommand).resolves({ fleets: mockFleetList });
    },
  },
};

// An offline timer — Emergency Stop is disabled (CAR + ONLINE only).
export const OfflineTimer: Story = {
  parameters: {
    routing: {
      componentRoute: '/devices/:instanceId',
      initialRouteEntries: [`/devices/${mockDevice2.instanceId}`],
    },
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({ devices: mockDeviceList });
      mockClient.on(ListFleetsCommand).resolves({ fleets: mockFleetList });
    },
  },
};
