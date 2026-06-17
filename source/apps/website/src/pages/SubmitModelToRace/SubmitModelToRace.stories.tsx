// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetModelCommand,
  ListLeaderboardsCommand,
  LiveEventStatus,
  NotFoundError,
} from '@deepracer-indy/typescript-client';
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

const mockLiveRaceOpen = {
  ...mockLeaderboards[0],
  leaderboardId: 'live-race-open',
  name: 'Live Race Open',
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  liveEventTime: new Date('2020-01-01'),
  submissionPeriodOpen: true,
};

const mockLiveRaceClosed = {
  ...mockLeaderboards[0],
  leaderboardId: 'live-race-closed',
  name: 'Live Race Closed',
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  liveEventTime: new Date('2020-01-01'),
  submissionPeriodOpen: false,
};

const mockLiveRaceCompleted = {
  ...mockLeaderboards[0],
  leaderboardId: 'live-race-completed',
  name: 'Live Race Completed',
  isLive: true,
  liveEventStatus: LiveEventStatus.COMPLETED,
  liveEventTime: new Date('2020-01-01'),
  submissionPeriodOpen: false,
};

export const LiveRaceSubmissionsOpen: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: [mockLiveRaceOpen] });
    },
  },
};

export const LiveRaceSubmissionsClosed: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: [mockLiveRaceClosed] });
    },
  },
};

export const LiveRaceCompleted: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetModelCommand).resolves({ model: mockModel });
      client.on(ListLeaderboardsCommand).resolves({ leaderboards: [mockLiveRaceCompleted] });
    },
  },
};
