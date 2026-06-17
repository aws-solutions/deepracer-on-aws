// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminProfile,
  AdminModel,
  GetAdminAssetUrlCommand,
  GetAdminAssetUrlCommandInput,
  GetAdminAssetUrlCommandOutput,
  ListAdminProfilesCommand,
  ListModelsForProfileCommand,
  ListModelsForProfileCommandInput,
} from '@deepracer-indy/typescript-client';

import { deepRacerApi } from './deepRacerApi.js';

export const adminApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    listAdminProfiles: build.query<AdminProfile[], void>({
      query: () => ({ command: new ListAdminProfilesCommand({}) }),
      transformResponse: (response: { profiles: AdminProfile[] }) => response.profiles,
    }),
    listModelsForProfile: build.query<AdminModel[], ListModelsForProfileCommandInput>({
      query: (input) => ({ command: new ListModelsForProfileCommand(input) }),
      transformResponse: (response: { models: AdminModel[] }) => response.models,
    }),
    getAdminAssetUrl: build.query<GetAdminAssetUrlCommandOutput, GetAdminAssetUrlCommandInput>({
      query: (input) => ({ command: new GetAdminAssetUrlCommand(input) }),
    }),
  }),
});

export const { useListAdminProfilesQuery, useListModelsForProfileQuery, useLazyGetAdminAssetUrlQuery } = adminApi;
