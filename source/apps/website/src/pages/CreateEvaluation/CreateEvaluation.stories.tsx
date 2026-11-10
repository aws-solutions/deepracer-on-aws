// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetModelCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockModel, mockModelCheckpoints } from '#constants/testConstants';
import CreateEvaluation from '#pages/CreateEvaluation';

const meta = {
  component: CreateEvaluation,
  title: 'pages/CreateEvaluation',
} satisfies Meta<typeof CreateEvaluation>;

export default meta;

type Story = StoryObj<typeof CreateEvaluation>;

export const Default: Story = {
  render: () => {
    return <CreateEvaluation />;
  },
};

/** The model's best and last checkpoints differ, so the racer can evaluate either. */
export const WithCheckpoints: Story = {
  parameters: {
    routing: {
      componentRoute: '/models/:modelId/evaluate',
      initialRouteEntries: [`/models/${mockModel.modelId}/evaluate`],
    },
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel, checkpoints: mockModelCheckpoints });
    },
  },
};
