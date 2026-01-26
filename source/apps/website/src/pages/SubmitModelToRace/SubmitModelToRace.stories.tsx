// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetModelCommand, ListLeaderboardsCommand, NotFoundError } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockLeaderboards, mockModel, mockModel3 } from '#constants/testConstants';
import SubmitModelToRace from '#pages/SubmitModelToRace';

const meta = {
  component: SubmitModelToRace,
  title: 'pages/SubmitModelToRace',
} satisfies Meta<typeof SubmitModelToRace>;

export default meta;

type Story = StoryObj<typeof SubmitModelToRace>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};

export const ModelNotFound: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).rejects(new NotFoundError({ message: 'Item not found', $metadata: {} }));
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};

export const ModelNotReady: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: { ...mockModel3, status: 'TRAINING' } });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};

export const NoOpenRaces: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: [] });
    },
  },
};

export const ModelError: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: { ...mockModel, status: 'ERROR' } });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};

export const ModelImporting: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: { ...mockModel, status: 'IMPORTING' } });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};
