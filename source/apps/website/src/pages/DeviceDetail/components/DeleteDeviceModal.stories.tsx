// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockDevice } from '#constants/testConstants.js';

import DeleteDeviceModal from './DeleteDeviceModal';

const meta = {
  component: DeleteDeviceModal,
  title: 'pages/DeviceDetail/DeleteDeviceModal',
} satisfies Meta<typeof DeleteDeviceModal>;

export default meta;

type Story = StoryObj<typeof DeleteDeviceModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    isDeleting: false,
    device: mockDevice,
    onDelete: () => console.log('onDelete'),
    onDismiss: () => console.log('onDismiss'),
  },
};

export const Deleting: Story = {
  args: {
    ...Default.args,
    isDeleting: true,
  },
};
