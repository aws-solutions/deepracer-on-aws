// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockFleet, mockFleetList } from '#constants/testConstants.js';

import ChangeFleetModal from './ChangeFleetModal';

const meta = {
  component: ChangeFleetModal,
  title: 'pages/DeviceDetail/ChangeFleetModal',
} satisfies Meta<typeof ChangeFleetModal>;

export default meta;

type Story = StoryObj<typeof ChangeFleetModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    isChanging: false,
    fleets: mockFleetList,
    currentFleetId: mockFleet.fleetId,
    onChangeFleet: () => console.log('onChangeFleet'),
    onDismiss: () => console.log('onDismiss'),
  },
};

export const Unassigned: Story = {
  args: {
    ...Default.args,
    currentFleetId: undefined,
  },
};

export const Changing: Story = {
  args: {
    ...Default.args,
    isChanging: true,
  },
};
