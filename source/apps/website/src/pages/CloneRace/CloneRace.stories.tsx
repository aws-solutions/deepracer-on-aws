// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetLeaderboardCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockLeaderboardTTFuture } from '#constants/testConstants.js';
import CloneRace from '#pages/CloneRace';

const meta = {
  component: CloneRace,
  title: 'pages/CloneRace',
} satisfies Meta<typeof CloneRace>;

export default meta;

type Story = StoryObj<typeof CloneRace>;
export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLeaderboardTTFuture });
    },
  },
};
