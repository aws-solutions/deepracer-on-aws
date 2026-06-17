// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetLeaderboardCommand,
  GetProfileCommand,
  ListLiveQueueItemsCommand,
  ListModelsCommand,
} from '@deepracer-indy/typescript-client';
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

/**
 * Live race with one model already submitted.
 * The dropdown should NOT show the already-submitted model.
 */
export const LiveRaceFiltered: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          ...mockLeaderboardTTFuture,
          isLive: true,
          liveEventStatus: 'IN_PROGRESS',
        },
      });
      client.on(ListModelsCommand).resolves({ models: mockModelList });
      client.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            leaderboardId: 'test-lb',
            submissionId: 'sub-1',
            profileId: 'p1',
            participantName: 'TestUser',
            modelId: mockModelList[0].modelId,
            modelName: mockModelList[0].name,
            queuePosition: 'a0',
            status: 'PENDING',
            resetCount: 0,
            submittedAt: new Date('2026-01-01T10:00:00Z'),
          },
        ],
      });
      client.on(GetProfileCommand).resolves({ profile: { alias: 'TestUser', profileId: 'p1', avatar: {} } });
    },
  },
};
