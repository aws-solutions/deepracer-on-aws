// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetModelCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockModel, mockModelCheckpoints } from '#constants/testConstants';
import CreateModel from '#pages/CreateModel';
import { createCloneModelFormValues } from '#pages/Models/utils';

const meta = {
  component: CreateModel,
  title: 'pages/CreateModel',
} satisfies Meta<typeof CreateModel>;

export default meta;

type Story = StoryObj<typeof CreateModel>;

export const Default: Story = {};

/** Cloning a model offers its best and last checkpoints to start from. */
export const CloneWithCheckpoints: Story = {
  parameters: {
    routing: {
      initialRouteEntries: [{ pathname: '/', state: { clonedModelFormValues: createCloneModelFormValues(mockModel) } }],
    },
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel, checkpoints: mockModelCheckpoints });
    },
  },
};
