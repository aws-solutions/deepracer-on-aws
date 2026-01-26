// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetLeaderboardCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockLeaderboardTTFuture } from '#constants/testConstants.js';
import EditRace from '#pages/EditRace';

const meta = {
  component: EditRace,
  title: 'pages/EditRace',
} satisfies Meta<typeof EditRace>;

export default meta;

type Story = StoryObj<typeof EditRace>;
export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLeaderboardTTFuture });
    },
  },
};
