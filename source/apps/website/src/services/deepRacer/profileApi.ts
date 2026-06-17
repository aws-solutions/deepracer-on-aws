// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateProfileCommand,
  CreateProfileCommandInput,
  CreateProfileCommandOutput,
  DeleteProfileCommand,
  DeleteProfileCommandInput,
  DeleteProfileCommandOutput,
  DeleteProfileModelsCommand,
  DeleteProfileModelsCommandInput,
  DeleteProfileModelsCommandOutput,
  GetProfileCommand,
  GetProfileCommandOutput,
  Profile,
  paginateListProfiles,
  UpdateGroupMembershipCommand,
  UpdateGroupMembershipCommandInput,
  UpdateGroupMembershipCommandOutput,
  UpdateProfileCommand,
  UpdateProfileCommandInput,
  UpdateProfileCommandOutput,
} from '@deepracer-indy/typescript-client';

import { DeepRacerApiQueryTagType } from './constants.js';
import { deepRacerApi, paginatedQuery } from './deepRacerApi.js';

export const createProfile = {
  createProfileCommand: (input: CreateProfileCommandInput) => ({
    command: new CreateProfileCommand(input),
    displayNotificationOnError: false,
  }),
  createProfileTransformResponse: (response: CreateProfileCommandOutput) => response.message,
};

export const updateProfile = {
  updateProfileCommand: (input: UpdateProfileCommandInput) => ({
    command: new UpdateProfileCommand(input),
  }),
  updateProfileTransformResponse: (response: UpdateProfileCommandOutput) => response.profile,
};

export const deleteProfile = {
  deleteProfileCommand: (input: DeleteProfileCommandInput) => ({
    command: new DeleteProfileCommand(input),
    displayNotificationOnError: false,
  }),
  deleteProfileTransformResponse: (response: DeleteProfileCommandOutput) => undefined,
};

export const deleteProfileModels = {
  deleteProfileModelsCommand: (input: DeleteProfileModelsCommandInput) => ({
    command: new DeleteProfileModelsCommand(input),
    displayNotificationOnError: false,
  }),
  deleteProfileModelsTransformResponse: (response: DeleteProfileModelsCommandOutput) => undefined,
};

export const updateGroupMembership = {
  updateGroupMembershipCommand: (input: UpdateGroupMembershipCommandInput) => ({
    command: new UpdateGroupMembershipCommand(input),
    displayNotificationOnError: false,
  }),
  updateGroupMembershipTransformResponse: (response: UpdateGroupMembershipCommandOutput) => undefined,
};

export const profileApi = deepRacerApi.injectEndpoints({
  endpoints: (build) => ({
    createProfile: build.mutation<string, CreateProfileCommandInput>({
      query: createProfile.createProfileCommand,
      transformResponse: createProfile.createProfileTransformResponse,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    getProfile: build.query<Profile, void>({
      query: () => ({
        command: new GetProfileCommand(),
        displayNotificationOnError: false,
      }),
      transformResponse: (response: GetProfileCommandOutput) => response.profile,
      providesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    updateProfile: build.mutation<Profile, UpdateProfileCommandInput>({
      query: updateProfile.updateProfileCommand,
      transformResponse: updateProfile.updateProfileTransformResponse,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    listProfiles: build.query<Profile[], void>({
      queryFn: (_input, { dispatch }) => paginatedQuery({}, paginateListProfiles, dispatch, 'profiles'),
      providesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    deleteProfile: build.mutation<void, DeleteProfileCommandInput>({
      query: deleteProfile.deleteProfileCommand,
      transformResponse: deleteProfile.deleteProfileTransformResponse,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    deleteProfileModels: build.mutation<void, DeleteProfileModelsCommandInput>({
      query: deleteProfileModels.deleteProfileModelsCommand,
      transformResponse: deleteProfileModels.deleteProfileModelsTransformResponse,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    updateGroupMembership: build.mutation<void, UpdateGroupMembershipCommandInput>({
      query: updateGroupMembership.updateGroupMembershipCommand,
      transformResponse: updateGroupMembership.updateGroupMembershipTransformResponse,
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
  }),
});

export const {
  useCreateProfileMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useListProfilesQuery,
  useDeleteProfileMutation,
  useDeleteProfileModelsMutation,
  useUpdateGroupMembershipMutation,
} = profileApi;
