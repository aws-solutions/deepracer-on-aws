// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminProfile,
  AdminModel,
  AdminModelExtended,
  GetAdminAssetUrlCommand,
  GetAdminAssetUrlCommandInput,
  GetAdminAssetUrlCommandOutput,
  ListAdminModelsCommand,
  ListAdminModelsCommandInput,
  ListAdminProfilesCommand,
  ListModelsForProfileCommand,
  ListModelsForProfileCommandInput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from './constants.js';
import { deepRacerApi } from './deepRacerApi.js';

export const adminApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listAdminProfiles: build.query<AdminProfile[], void>({
      query: () => ({ command: new ListAdminProfilesCommand({}) }),
      transformResponse: (response: { profiles: AdminProfile[] }) => response.profiles,
    }),
    listAdminModels: build.query<AdminModelExtended[], ListAdminModelsCommandInput>({
      query: (input) => ({ command: new ListAdminModelsCommand(input ?? {}) }),
      transformResponse: (response: { models: AdminModelExtended[] }) => response.models,
      providesTags: (result) =>
        result
          ? [
              ...result.map((m) => ({ type: DeepRacerApiQueryTagType.MODELS, id: m.modelId }) as const),
              { type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID },
            ]
          : [{ type: DeepRacerApiQueryTagType.MODELS, id: LIST_QUERY_TAG_ID }],
    }),
    listModelsForProfile: build.query<AdminModel[], ListModelsForProfileCommandInput>({
      query: (input) => ({ command: new ListModelsForProfileCommand(input) }),
      transformResponse: (response: { models: AdminModel[] }) => response.models,
    }),
    getAdminAssetUrl: build.query<GetAdminAssetUrlCommandOutput, GetAdminAssetUrlCommandInput>({
      query: (input) => ({ command: new GetAdminAssetUrlCommand(input), displayNotificationOnError: false }),
    }),
  }),
});

export const {
  useListAdminProfilesQuery,
  useListAdminModelsQuery,
  useListModelsForProfileQuery,
  useLazyGetAdminAssetUrlQuery,
} = adminApi;
