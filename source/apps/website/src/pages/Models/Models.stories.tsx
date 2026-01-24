// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListModelsCommand, ModelStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockModel, mockModel2 } from '#constants/testConstants.js';
import Models from '#pages/Models';

const meta = {
  component: Models,
  title: 'pages/Models',
} satisfies Meta<typeof Models>;

export default meta;

type Story = StoryObj<typeof Models>;

export const Default: Story = {
  args: {},
};

export const WithTrainingModel: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListModelsCommand).resolves({
        models: [{ ...mockModel, status: ModelStatus.TRAINING, name: 'Training Model' }, mockModel2],
      });
    },
  },
};

export const WithReadyModel: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListModelsCommand).resolves({
        models: [mockModel, mockModel2],
      });
    },
  },
};
