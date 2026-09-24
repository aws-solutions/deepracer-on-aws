// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListFleetsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockFleetList } from '#constants/testConstants.js';

import FleetList from './FleetList';

const meta = {
  component: FleetList,
  title: 'pages/FleetList',
} satisfies Meta<typeof FleetList>;

export default meta;

type Story = StoryObj<typeof FleetList>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListFleetsCommand).resolves({ fleets: mockFleetList });
    },
  },
};

export const Empty: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListFleetsCommand).resolves({ fleets: [] });
    },
  },
};
