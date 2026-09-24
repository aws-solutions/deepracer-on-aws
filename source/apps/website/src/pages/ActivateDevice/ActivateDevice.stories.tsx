// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListFleetsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockFleetList } from '#constants/testConstants.js';

import ActivateDevice from './ActivateDevice';

const meta = {
  component: ActivateDevice,
  title: 'pages/ActivateDevice',
} satisfies Meta<typeof ActivateDevice>;

export default meta;

type Story = StoryObj<typeof ActivateDevice>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListFleetsCommand).resolves({ fleets: mockFleetList });
    },
  },
};
