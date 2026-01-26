// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListLeaderboardsCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockLeaderboards } from '#constants/testConstants.js';
import ManageRaces from '#pages/ManageRaces';

const meta = {
  component: ManageRaces,
  title: 'pages/ManageRaces',
} satisfies Meta<typeof ManageRaces>;

export default meta;

type Story = StoryObj<typeof ManageRaces>;
export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: mockLeaderboards });
    },
  },
};
