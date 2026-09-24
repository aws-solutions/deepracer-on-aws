// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetEventLeaderboardCommand,
  GetRaceStatsCommand,
  type GetEventLeaderboardCommandOutput,
  type GetRaceStatsOutput,
} from '@deepracer-indy/typescript-client';

import { deepRacerApi } from './deepRacerApi.js';

export const raceManagementApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    getRaceStats: build.query<GetRaceStatsOutput, void>({
      query: () => ({ command: new GetRaceStatsCommand({}) }),
    }),
    getEventLeaderboard: build.query<
      {
        rankings: Array<{
          rank: number;
          participantName: string;
          bestLapTimeMilliseconds: number;
          modelName?: string;
          country?: string;
        }>;
      },
      { eventId: string; trackId: string }
    >({
      query: ({ eventId, trackId }) => ({
        command: new GetEventLeaderboardCommand({ eventId, trackId }),
        // 404 is expected when no leaderboard exists yet — suppress global error notification
        displayNotificationOnError: false,
      }),
      transformResponse: (response: GetEventLeaderboardCommandOutput) => ({
        rankings: response.rankings.map((item) => ({
          rank: item.rank,
          participantName: item.participantName,
          bestLapTimeMilliseconds: item.bestLapTimeMilliseconds,
          modelName: item.modelName,
        })),
      }),
    }),
  }),
});

export const { useGetRaceStatsQuery, useGetEventLeaderboardQuery } = raceManagementApi;
