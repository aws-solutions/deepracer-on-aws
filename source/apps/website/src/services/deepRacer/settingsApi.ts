// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetGlobalSettingCommand,
  GetGlobalSettingCommandInput,
  GetGlobalSettingCommandOutput,
  UpdateGlobalSettingCommand,
  UpdateGlobalSettingCommandInput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType } from './constants.js';
import { deepRacerApi } from './deepRacerApi.js';

export const getGlobalSettingCommand = (input: GetGlobalSettingCommandInput) => ({
  command: new GetGlobalSettingCommand(input),
});

export const getGlobalSettingTags = (_result: unknown, _meta: unknown, { key }: GetGlobalSettingCommandInput) => [
  { type: DeepRacerApiQueryTagType.SETTINGS, id: key },
];

export const updateGlobalSettingCommand = (input: UpdateGlobalSettingCommandInput) => ({
  command: new UpdateGlobalSettingCommand(input),
});

export const updateGlobalSettingInvalidationTags = (
  _result: unknown,
  _meta: unknown,
  { key }: UpdateGlobalSettingCommandInput,
) => {
  const tags = [{ type: DeepRacerApiQueryTagType.SETTINGS, id: key }];

  if (key === 'usageQuotas.global') {
    tags.push(
      { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.global.globalComputeMinutesLimit' },
      { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.global.globalModelCountLimit' },
    );
  }

  if (key === 'usageQuotas.newUser') {
    tags.push(
      { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.newUser.newUserComputeMinutesLimit' },
      { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.newUser.newUserModelCountLimit' },
    );
  }

  return tags;
};

export const settingsApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    getGlobalSetting: build.query<string, GetGlobalSettingCommandInput>({
      query: getGlobalSettingCommand,
      transformResponse: (response: GetGlobalSettingCommandOutput) => String(response.value),
      providesTags: getGlobalSettingTags,
    }),
    updateGlobalSetting: build.mutation<Record<string, DocumentType>, UpdateGlobalSettingCommandInput>({
      query: updateGlobalSettingCommand,
      invalidatesTags: updateGlobalSettingInvalidationTags,
    }),
  }),
});

export const { useGetGlobalSettingQuery, useUpdateGlobalSettingMutation } = settingsApi;
