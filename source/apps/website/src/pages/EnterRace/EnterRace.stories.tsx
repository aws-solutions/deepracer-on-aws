// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetLeaderboardCommand, ListModelsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockLeaderboardTTFuture, mockModelList } from '#constants/testConstants.js';
import EnterRace from '#pages/EnterRace';

const meta = {
  component: EnterRace,
  title: 'pages/EnterRace',
} satisfies Meta<typeof EnterRace>;

export default meta;

type Story = StoryObj<typeof EnterRace>;
export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLeaderboardTTFuture });
      client.on(ListModelsCommand).resolves({ models: mockModelList });
    },
  },
};

export const EmptyModel: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLeaderboardTTFuture });
    },
  },
};
