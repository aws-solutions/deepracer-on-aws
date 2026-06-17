// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetLeaderboardCommand,
  GetLiveRaceStateCommand,
  GetModelCommand,
  GetProfileCommand,
  Leaderboard,
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

const mockLiveLeaderboard: Leaderboard = {
  ...mockLeaderboardTT,
  name: 'Live Race - Friday Event',
  isLive: true,
  liveEventTime: new Date('2026-05-01T14:00:00Z'),
  liveEventStatus: 'IN_PROGRESS' as const,
  leaderboardId: 'live-race-123',
};

export const LiveRaceSubmissionsClosed: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(ListSubmissionsCommand).resolves({ submissions: mockSubmissions });
      client.on(ListRankingsCommand).resolves({ rankings: mockRankings });
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLiveLeaderboard });
      client.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'live-race-123',
          name: 'Live Race - Friday Event',
          isLive: true,
          submissionPeriodOpen: false,
          autoLaunchEnabled: false,
          liveEventStatus: 'IN_PROGRESS',
        },
        queue: { totalModels: 5, completedModels: 2, pendingModels: 3, inProgressModels: 0 },
        rankings: [],
      });
      client.on(GetProfileCommand).resolves({ profile: mockProfile });
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListModelsCommand).resolves({ models: [mockModel] });
    },
    routing: {
      componentRoute: '/races/:leaderboardId',
      initialRouteEntries: ['/races/live-race-123'],
    },
  },
};

export const LiveRaceSubmissionsOpen: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(ListSubmissionsCommand).resolves({ submissions: mockSubmissions });
      client.on(ListRankingsCommand).resolves({ rankings: mockRankings });
      client.on(GetLeaderboardCommand).resolves({ leaderboard: mockLiveLeaderboard });
      client.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'live-race-123',
          name: 'Live Race - Friday Event',
          isLive: true,
          submissionPeriodOpen: true,
          autoLaunchEnabled: false,
          liveEventStatus: 'IN_PROGRESS',
        },
        queue: { totalModels: 5, completedModels: 2, pendingModels: 3, inProgressModels: 0 },
        rankings: [],
      });
      client.on(GetProfileCommand).resolves({ profile: mockProfile });
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListModelsCommand).resolves({ models: [mockModel] });
    },
    routing: {
      componentRoute: '/races/:leaderboardId',
      initialRouteEntries: ['/races/live-race-123'],
    },
  },
};
