// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockFleetList } from '#constants/testConstants.js';

import MoveToFleetModal from './MoveToFleetModal';

const meta = {
  component: MoveToFleetModal,
  title: 'pages/DeviceList/MoveToFleetModal',
} satisfies Meta<typeof MoveToFleetModal>;

export default meta;

type Story = StoryObj<typeof MoveToFleetModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    isMoving: false,
    deviceCount: 3,
    fleets: mockFleetList,
    onMove: () => console.log('onMove'),
    onDismiss: () => console.log('onDismiss'),
  },
};

export const SingleDevice: Story = {
  args: {
    ...Default.args,
    deviceCount: 1,
  },
};

export const Moving: Story = {
  args: {
    ...Default.args,
    isMoving: true,
  },
};
