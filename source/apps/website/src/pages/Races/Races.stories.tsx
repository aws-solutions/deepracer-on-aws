// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListLeaderboardsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockLeaderboards } from '#constants/testConstants.js';
import Races from '#pages/Races';

const meta = {
  component: Races,
  title: 'pages/Races',
} satisfies Meta<typeof Races>;

export default meta;

type Story = StoryObj<typeof Races>;
export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};
