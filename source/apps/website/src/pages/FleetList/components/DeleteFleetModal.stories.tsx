// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockFleet } from '#constants/testConstants.js';

import DeleteFleetModal from './DeleteFleetModal';

const meta = {
  component: DeleteFleetModal,
  title: 'pages/FleetList/DeleteFleetModal',
} satisfies Meta<typeof DeleteFleetModal>;

export default meta;

type Story = StoryObj<typeof DeleteFleetModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    isDeleting: false,
    fleet: mockFleet,
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
