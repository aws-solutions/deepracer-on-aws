// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  GetLeaderboardCommand,
  GetLiveRaceStateCommand,
  GetProfileCommand,
  ListLiveQueueItemsCommand,
  EditLeaderboardCommand,
  LaunchLiveRaceCommand,
  ClearLiveLeaderboardCommand,
  DeclareWinnerCommand,
  RemoveLiveQueueItemCommand,
  ResetLiveQueueModelCommand,
  ReorderLiveQueueCommand,
} from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import LiveRace from './LiveRace';

const meta: Meta<typeof LiveRace> = {
  component: LiveRace,
  title: 'LiveRace/LiveRacePage',
  parameters: {
    layout: 'fullscreen',
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live'],
    },
    deepRacerApiMocks: (mockClient: any) => {
      mockClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          isLive: true,
          liveEventTime: new Date(Date.now() + 3600000),
          maxSubmissionsPerUser: 1,
        },
      });
      mockClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          liveEventStatus: 'SCHEDULED',
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: true,
        },
        queue: { totalModels: 3, completedModels: 0 },
        rankings: [],
      });
      mockClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            submissionId: '1',
            participantName: 'Alice',
            modelName: 'SpeedDemon-v3',
            queuePosition: 'a0',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:00:00Z',
          },
          {
            submissionId: '2',
            participantName: 'Bob',
            modelName: 'TurboRacer-v1',
            queuePosition: 'a1',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:01:00Z',
          },
          {
            submissionId: '3',
            participantName: 'Charlie',
            modelName: 'FastLane-v2',
            queuePosition: 'a2',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:02:00Z',
          },
        ],
      });
      // Mutation mocks (resolve successfully so optimistic updates stick)
      mockClient.on(EditLeaderboardCommand).resolves({ leaderboard: {} });
      mockClient.on(LaunchLiveRaceCommand).resolves({});
      mockClient.on(ClearLiveLeaderboardCommand).resolves({});
      mockClient.on(DeclareWinnerCommand).resolves({});
      mockClient.on(RemoveLiveQueueItemCommand).resolves({});
      mockClient.on(ResetLiveQueueModelCommand).resolves({});
      mockClient.on(ReorderLiveQueueCommand).resolves({});
    },
  },
};
export default meta;

type Story = StoryObj<typeof LiveRace>;

export const ScheduledRace: Story = {
  args: { __forceFacilitator: true },
};

export const InProgressRace: Story = {
  args: { __forceFacilitator: true },
  parameters: {
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live'],
    },
    deepRacerApiMocks: (mockClient: any) => {
      mockClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          isLive: true,
          liveEventTime: new Date(Date.now() - 3600000),
          maxSubmissionsPerUser: 1,
        },
      });
      mockClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          liveEventStatus: 'IN_PROGRESS',
          isLive: true,
          autoLaunchEnabled: true,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 10, completedModels: 1 },
        rankings: [
          { rank: 1, participantName: 'Alice', modelName: 'SpeedDemon-v3', bestLapTime: 12345 },
          { rank: 2, participantName: 'Charlie', modelName: 'FastLane-v2', bestLapTime: 13200 },
          { rank: 3, participantName: 'Diana', modelName: 'RocketModel-v4', bestLapTime: 13800 },
          { rank: 4, participantName: 'Eve', modelName: 'LightningBot-v1', bestLapTime: 14100 },
          { rank: 5, participantName: 'Frank', modelName: 'NitroCharge-v2', bestLapTime: 14500 },
          { rank: 6, participantName: 'Gabriella', modelName: 'SuperSpeedster-v99', bestLapTime: 15200 },
          { rank: 7, participantName: 'Hiro', modelName: 'ZenRacer-v3', bestLapTime: 15800 },
          { rank: 8, participantName: 'Isabella', modelName: 'ThunderBolt-v12', bestLapTime: 16400 },
          { rank: 9, participantName: 'Jake', modelName: 'QuickSilver-v1', bestLapTime: 17000 },
          { rank: 10, participantName: 'Karen', modelName: 'TurboMax-v5', bestLapTime: 17600 },
        ],
        currentEvaluation: {
          participantName: 'Bob',
          modelName: 'TurboRacer-v1',
          streamUrl: null,
        },
      });
      mockClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            submissionId: '1',
            participantName: 'Alice',
            modelName: 'SpeedDemon-v3',
            queuePosition: 'a0',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:00:00Z',
          },
          {
            submissionId: '2',
            participantName: 'Bob',
            modelName: 'TurboRacer-v1',
            queuePosition: 'a1',
            status: 'IN_PROGRESS',
            submittedAt: '2026-01-01T10:01:00Z',
          },
          {
            submissionId: '3',
            participantName: 'Charlie',
            modelName: 'FastLane-v2',
            queuePosition: 'a2',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:02:00Z',
          },
          {
            submissionId: '4',
            participantName: 'Diana',
            modelName: 'RocketModel-v4',
            queuePosition: 'a3',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:03:00Z',
          },
          {
            submissionId: '5',
            participantName: 'Eve',
            modelName: 'LightningBot-v1',
            queuePosition: 'a4',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:04:00Z',
          },
          {
            submissionId: '6',
            participantName: 'Frank',
            modelName: 'NitroCharge-v2',
            queuePosition: 'a5',
            status: 'FAILED',
            submittedAt: '2026-01-01T10:05:00Z',
          },
          {
            submissionId: '7',
            participantName: 'Gabriella Hernandez-Rodriguez',
            modelName: 'SuperUltraMegaSpeedsterModel-v99-final-FINAL',
            queuePosition: 'a6',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:06:00Z',
          },
          {
            submissionId: '8',
            participantName: 'Hiro',
            modelName: 'ZenRacer-v3',
            queuePosition: 'a7',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:07:00Z',
          },
          {
            submissionId: '9',
            participantName: 'Isabella Johansson-Petersson',
            modelName: 'ThunderBolt-ReinforcementLearning-Optimized-v12',
            queuePosition: 'a8',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:08:00Z',
          },
          {
            submissionId: '10',
            participantName: 'Jake',
            modelName: 'QuickSilver-v1',
            queuePosition: 'a9',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:09:00Z',
          },
        ],
      });
      mockClient.on(EditLeaderboardCommand).resolves({ leaderboard: {} });
      mockClient.on(LaunchLiveRaceCommand).resolves({});
      mockClient.on(ClearLiveLeaderboardCommand).resolves({});
      mockClient.on(DeclareWinnerCommand).resolves({});
      mockClient.on(RemoveLiveQueueItemCommand).resolves({});
      mockClient.on(ResetLiveQueueModelCommand).resolves({});
      mockClient.on(ReorderLiveQueueCommand).resolves({});
    },
  },
};

export const BroadcastMode: Story = {
  args: { __forceFacilitator: false },
  parameters: {
    layout: 'fullscreen',
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live?mode=broadcast'],
    },
  },
};

export const AllModelsComplete: Story = {
  args: { __forceFacilitator: true },
  parameters: {
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live'],
    },
    deepRacerApiMocks: (mockClient: any) => {
      mockClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          isLive: true,
          liveEventTime: new Date(Date.now() - 3600000),
          maxSubmissionsPerUser: 1,
        },
      });
      mockClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          liveEventStatus: 'IN_PROGRESS',
          isLive: true,
          autoLaunchEnabled: true,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 3, completedModels: 3 },
        rankings: [
          { rank: 1, participantName: 'Alice', modelName: 'SpeedDemon-v3', bestLapTime: 12345 },
          { rank: 2, participantName: 'Bob', modelName: 'TurboRacer-v1', bestLapTime: 13456 },
          { rank: 3, participantName: 'Charlie', modelName: 'FastLane-v2', bestLapTime: 14567 },
        ],
      });
      mockClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            submissionId: '1',
            participantName: 'Alice',
            modelName: 'SpeedDemon-v3',
            queuePosition: 'a0',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:00:00Z',
          },
          {
            submissionId: '2',
            participantName: 'Bob',
            modelName: 'TurboRacer-v1',
            queuePosition: 'a1',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:01:00Z',
          },
          {
            submissionId: '3',
            participantName: 'Charlie',
            modelName: 'FastLane-v2',
            queuePosition: 'a2',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:02:00Z',
          },
        ],
      });
      mockClient.on(EditLeaderboardCommand).resolves({ leaderboard: {} });
      mockClient.on(LaunchLiveRaceCommand).resolves({});
      mockClient.on(ClearLiveLeaderboardCommand).resolves({});
      mockClient.on(DeclareWinnerCommand).resolves({});
      mockClient.on(RemoveLiveQueueItemCommand).resolves({});
      mockClient.on(ResetLiveQueueModelCommand).resolves({});
      mockClient.on(ReorderLiveQueueCommand).resolves({});
    },
  },
};

/**
 * To see the reset progress bar:
 * 1. Select the IN_PROGRESS item (Bob) in the Racer Queue
 * 2. Click "Reset" in the header
 * 3. Watch the progress bar fill over 30 seconds
 */
export const ResetProgressBar: Story = {
  args: { __forceFacilitator: true },
  parameters: {
    ...InProgressRace.parameters,
  },
};

export const WinnerDeclared: Story = {
  args: { __forceFacilitator: true },
  parameters: {
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live'],
    },
    deepRacerApiMocks: (mockClient: any) => {
      mockClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          isLive: true,
          liveEventTime: new Date(Date.now() - 3600000),
          maxSubmissionsPerUser: 1,
          timingMethod: 'BEST_LAP_TIME',
        },
      });
      mockClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          liveEventStatus: 'COMPLETED',
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 3, completedModels: 3 },
        rankings: [
          { rank: 1, participantName: 'Alice', modelName: 'SpeedDemon-v3', bestLapTime: 12345 },
          { rank: 2, participantName: 'Bob', modelName: 'TurboRacer-v1', bestLapTime: 13456 },
          { rank: 3, participantName: 'Charlie', modelName: 'FastLane-v2', bestLapTime: 14567 },
        ],
        winner: { submissionId: '1', winnerDeclaredAt: new Date() },
      });
      mockClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            submissionId: '1',
            participantName: 'Alice',
            modelName: 'SpeedDemon-v3',
            queuePosition: 'a0',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:00:00Z',
          },
          {
            submissionId: '2',
            participantName: 'Bob',
            modelName: 'TurboRacer-v1',
            queuePosition: 'a1',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:01:00Z',
          },
          {
            submissionId: '3',
            participantName: 'Charlie',
            modelName: 'FastLane-v2',
            queuePosition: 'a2',
            status: 'COMPLETED',
            submittedAt: '2026-01-01T10:02:00Z',
          },
        ],
      });
      mockClient.on(EditLeaderboardCommand).resolves({ leaderboard: {} });
      mockClient.on(LaunchLiveRaceCommand).resolves({});
      mockClient.on(ClearLiveLeaderboardCommand).resolves({});
      mockClient.on(DeclareWinnerCommand).resolves({});
      mockClient.on(RemoveLiveQueueItemCommand).resolves({});
      mockClient.on(ResetLiveQueueModelCommand).resolves({});
      mockClient.on(ReorderLiveQueueCommand).resolves({});
    },
  },
};

export const SpectatorWaitingForLaunch: Story = {
  args: { __forceFacilitator: false },
  parameters: {
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live'],
    },
    deepRacerApiMocks: (mockClient: any) => {
      mockClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          isLive: true,
          liveEventTime: new Date(Date.now() - 60000),
          maxSubmissionsPerUser: 1,
        },
      });
      mockClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          liveEventStatus: 'IN_PROGRESS',
          isLive: true,
          autoLaunchEnabled: false,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 3, completedModels: 0 },
        rankings: [],
      });
      mockClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            submissionId: '1',
            participantName: 'Alice',
            modelName: 'SpeedDemon-v3',
            queuePosition: 'a0',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:00:00Z',
          },
          {
            submissionId: '2',
            participantName: 'Bob',
            modelName: 'TurboRacer-v1',
            queuePosition: 'a1',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:01:00Z',
          },
          {
            submissionId: '3',
            participantName: 'Charlie',
            modelName: 'FastLane-v2',
            queuePosition: 'a2',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:02:00Z',
          },
        ],
      });
      mockClient.on(EditLeaderboardCommand).resolves({ leaderboard: {} });
      mockClient.on(LaunchLiveRaceCommand).resolves({});
      mockClient.on(ClearLiveLeaderboardCommand).resolves({});
      mockClient.on(DeclareWinnerCommand).resolves({});
      mockClient.on(RemoveLiveQueueItemCommand).resolves({});
      mockClient.on(ResetLiveQueueModelCommand).resolves({});
      mockClient.on(ReorderLiveQueueCommand).resolves({});
    },
  },
};

export const SpectatorComingUp: Story = {
  args: { __forceFacilitator: false },
  parameters: {
    routing: {
      componentRoute: '/races/:leaderboardId/live',
      initialRouteEntries: ['/races/T3HtdXQMPPEkAuO/live'],
    },
    deepRacerApiMocks: (mockClient: any) => {
      mockClient.on(GetLeaderboardCommand).resolves({
        leaderboard: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          isLive: true,
          liveEventTime: new Date(Date.now() - 3600000),
          maxSubmissionsPerUser: 1,
          timingMethod: 'BEST_LAP_TIME',
        },
      });
      mockClient.on(GetLiveRaceStateCommand).resolves({
        race: {
          leaderboardId: 'T3HtdXQMPPEkAuO',
          name: 'Friday Fun Race',
          liveEventStatus: 'IN_PROGRESS',
          isLive: true,
          autoLaunchEnabled: true,
          submissionPeriodOpen: false,
        },
        queue: { totalModels: 7, completedModels: 3 },
        rankings: [
          { rank: 1, participantName: 'Hiro', modelName: 'ZenRacer-v3', bestLapTime: 11200 },
          { rank: 2, participantName: 'Jake', modelName: 'QuickSilver-v1', bestLapTime: 12400 },
          { rank: 3, participantName: 'Karen', modelName: 'TurboMax-v5', bestLapTime: 13100 },
          { rank: 4, participantName: 'Leo', modelName: 'DriftKing-v2', bestLapTime: 13800 },
          { rank: 5, participantName: 'Mia', modelName: 'Velocity-v4', bestLapTime: 14500 },
          { rank: 6, participantName: 'Noah', modelName: 'Blaze-v1', bestLapTime: 15200 },
          { rank: 7, participantName: 'Olivia', modelName: 'Phoenix-v3', bestLapTime: 16000 },
        ],
        currentEvaluation: {
          participantName: 'Alice',
          modelName: 'SpeedDemon-v3',
          streamUrl: null,
        },
      });
      mockClient.on(ListLiveQueueItemsCommand).resolves({
        items: [
          {
            submissionId: '1',
            participantName: 'Alice',
            modelName: 'SpeedDemon-v3',
            queuePosition: 'a0',
            status: 'IN_PROGRESS',
            submittedAt: '2026-01-01T10:00:00Z',
          },
          {
            submissionId: '2',
            participantName: 'Bob',
            modelName: 'TurboRacer-v1',
            queuePosition: 'a1',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:01:00Z',
          },
          {
            submissionId: '3',
            participantName: 'Charlie',
            modelName: 'FastLane-v2',
            queuePosition: 'a2',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:02:00Z',
          },
          {
            submissionId: '4',
            participantName: 'Diana',
            modelName: 'RocketModel-v4',
            queuePosition: 'a3',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:03:00Z',
          },
          {
            submissionId: '5',
            participantName: 'Eve',
            modelName: 'LightningBot-v1',
            queuePosition: 'a4',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:04:00Z',
          },
          {
            submissionId: '6',
            participantName: 'Frank',
            modelName: 'NitroCharge-v2',
            queuePosition: 'a5',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:05:00Z',
          },
          {
            submissionId: '7',
            participantName: 'Grace',
            modelName: 'HyperDrive-v1',
            queuePosition: 'a6',
            status: 'PENDING',
            submittedAt: '2026-01-01T10:06:00Z',
          },
        ],
      });
      // Mock profile — "Charlie" is the current user
      mockClient.on(GetProfileCommand).resolves({ profile: { alias: 'Charlie', profileId: 'p3', avatar: {} } });
      mockClient.on(EditLeaderboardCommand).resolves({ leaderboard: {} });
      mockClient.on(LaunchLiveRaceCommand).resolves({});
      mockClient.on(ClearLiveLeaderboardCommand).resolves({});
      mockClient.on(DeclareWinnerCommand).resolves({});
      mockClient.on(RemoveLiveQueueItemCommand).resolves({});
      mockClient.on(ResetLiveQueueModelCommand).resolves({});
      mockClient.on(ReorderLiveQueueCommand).resolves({});
    },
  },
};
