// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetRankingCommand,
  GetRankingCommandInput,
  GetRankingCommandOutput,
  ListRankingsCommandInput,
  paginateListRankings,
  PersonalRanking,
  Ranking,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const rankingsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    getRanking: build.query<PersonalRanking | undefined, GetRankingCommandInput>({
      query: (input) => ({ command: new GetRankingCommand(input) }),
      transformResponse: (response: GetRankingCommandOutput) => response.ranking,
      providesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.RANKINGS, id: leaderboardId },
      ],
    }),
    listRankings: build.query<Ranking[], ListRankingsCommandInput>({
      queryFn: (input, { dispatch }) => paginatedQuery(input, paginateListRankings, dispatch, 'rankings'),
      providesTags: (_result, _meta, { leaderboardId }) => [
        { type: DeepRacerApiQueryTagType.RANKINGS, id: `${leaderboardId}-${LIST_QUERY_TAG_ID}` },
      ],
    }),
  }),
});

export const { useGetRankingQuery, useListRankingsQuery } = rankingsApi;
