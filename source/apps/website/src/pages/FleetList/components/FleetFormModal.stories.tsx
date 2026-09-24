// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockFleet } from '#constants/testConstants.js';

import FleetFormModal from './FleetFormModal';

const meta = {
  component: FleetFormModal,
  title: 'pages/FleetList/FleetFormModal',
} satisfies Meta<typeof FleetFormModal>;

export default meta;

type Story = StoryObj<typeof FleetFormModal>;

export const Create: Story = {
  args: {
    isVisible: true,
    fleet: undefined,
    onDismiss: () => console.log('onDismiss'),
  },
};

export const Edit: Story = {
  args: {
    isVisible: true,
    fleet: mockFleet,
    onDismiss: () => console.log('onDismiss'),
  },
};
