// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListDevicesCommand, ListFleetsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockDeviceList, mockFleetList } from '#constants/testConstants.js';

import DeviceList from './DeviceList';

const meta = {
  component: DeviceList,
  title: 'pages/DeviceList',
} satisfies Meta<typeof DeviceList>;

export default meta;

type Story = StoryObj<typeof DeviceList>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({ devices: mockDeviceList });
      mockClient.on(ListFleetsCommand).resolves({ fleets: mockFleetList });
    },
  },
};

export const Empty: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({ devices: [] });
      mockClient.on(ListFleetsCommand).resolves({ fleets: [] });
    },
  },
};
