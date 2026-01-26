// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import RaceOverview from '#components/RaceOverview';
import { mockLeaderboardOA, mockLeaderboardTT } from '#constants/testConstants.js';

const meta = {
  component: RaceOverview,
  title: 'RaceOverview',
  render: (args) => {
    return (
      <div style={{ maxWidth: 1400 }}>
        <RaceOverview {...args} />
      </div>
    );
  },
} satisfies Meta<typeof RaceOverview>;

export default meta;

type Story = StoryObj<typeof RaceOverview>;

export const TimeTrial: Story = {
  args: {
    leaderboard: mockLeaderboardTT,
  },
};

export const ObjectAvoidance: Story = {
  args: {
    leaderboard: mockLeaderboardOA,
  },
};
