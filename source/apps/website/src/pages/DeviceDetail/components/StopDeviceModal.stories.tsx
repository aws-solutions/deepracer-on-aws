// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockDevice } from '#constants/testConstants.js';

import StopDeviceModal from './StopDeviceModal';

const meta = {
  component: StopDeviceModal,
  title: 'pages/DeviceDetail/StopDeviceModal',
} satisfies Meta<typeof StopDeviceModal>;

export default meta;

type Story = StoryObj<typeof StopDeviceModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    isStopping: false,
    device: mockDevice,
    onStop: () => console.log('onStop'),
    onDismiss: () => console.log('onDismiss'),
  },
};

export const Stopping: Story = {
  args: {
    ...Default.args,
    isStopping: true,
  },
};
