// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetLeaderboardCommand,
  GetModelCommand,
  GetProfileCommand,
  ListModelsCommand,
  ListRankingsCommand,
  ListSubmissionsCommand,
} from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import {
  mockLeaderboardOA,
  mockLeaderboardTT,
  mockModel,
  mockProfile,
  mockProfileNoAvatar,
  mockRankings,
  mockSubmissions,
} from '#constants/testConstants';
import RaceDetails from '#pages/RaceDetails';

const meta = {
  component: RaceDetails,
  title: 'pages/RaceDetails',
} satisfies Meta<typeof RaceDetails>;

export default meta;

type Story = StoryObj<typeof RaceDetails>;
export const OALeaderboard: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(ListSubmissionsCommand).resolves({ submissions: mockSubmissions });
      client.on(ListRankingsCommand).resolves({ rankings: mockRankings });
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLeaderboardOA });
      client.on(GetProfileCommand).resolves({ profile: mockProfile });
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListModelsCommand).resolves({ models: [mockModel] });
    },
  },
};

export const TTLeaderboard: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(ListSubmissionsCommand).resolves({ submissions: mockSubmissions });
      client.on(ListRankingsCommand).resolves({ rankings: mockRankings });
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLeaderboardTT });
      client.on(GetProfileCommand).resolves({ profile: mockProfileNoAvatar });
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListModelsCommand).resolves({ models: [mockModel] });
    },
  },
};
