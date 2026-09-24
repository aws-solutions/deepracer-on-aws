// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  BulkInviteUserCommand,
  BulkInviteUserCommandInput,
  BulkInviteUserCommandOutput,
  BulkInviteJobStatus,
  CreateProfileCommand,
  CreateProfileCommandInput,
  CreateProfileCommandOutput,
  DeleteProfileCommand,
  DeleteProfileCommandInput,
  DeleteProfileCommandOutput,
  DeleteProfileModelsCommand,
  DeleteProfileModelsCommandInput,
  DeleteProfileModelsCommandOutput,
  GetBulkInviteUserJobStatusCommand,
  GetBulkInviteUserJobStatusCommandInput,
  GetBulkInviteUserJobStatusCommandOutput,
  GetProfileCommand,
  GetProfileCommandOutput,
  Profile,
  paginateListProfiles,
  RegisterUserCommand,
  ResendInviteCommand,
  ResendInviteCommandInput,
  ResendInviteCommandOutput,
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

export interface BulkInviteJobSummary {
  jobId: string;
  status: BulkInviteJobStatus;
  totalEntries: number;
}

export const bulkInviteUser = {
  bulkInviteUserCommand: (input: BulkInviteUserCommandInput) => ({
    command: new BulkInviteUserCommand(input),
    displayNotificationOnError: false,
  }),
  bulkInviteUserTransformResponse: (response: BulkInviteUserCommandOutput): BulkInviteJobSummary => ({
    jobId: response.jobId,
    status: response.status,
    totalEntries: response.totalEntries,
  }),
};

export const getBulkInviteUserJobStatus = {
  getBulkInviteUserJobStatusCommand: (input: GetBulkInviteUserJobStatusCommandInput) => ({
    command: new GetBulkInviteUserJobStatusCommand(input),
    displayNotificationOnError: false,
  }),
  getBulkInviteUserJobStatusTransformResponse: (response: GetBulkInviteUserJobStatusCommandOutput) => response,
};

export const resendInvite = {
  resendInviteCommand: (input: ResendInviteCommandInput) => ({
    command: new ResendInviteCommand(input),
    displayNotificationOnError: false,
  }),
  resendInviteTransformResponse: (response: ResendInviteCommandOutput) => response.message,
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
    registerUser: build.mutation<{ id: string }, { emailAddress: string; countryCode?: string }>({
      query: (input) => ({ command: new RegisterUserCommand(input) }),
      invalidatesTags: [{ type: DeepRacerApiQueryTagType.PROFILE }],
    }),
    bulkInviteUser: build.mutation<BulkInviteJobSummary, BulkInviteUserCommandInput>({
      query: bulkInviteUser.bulkInviteUserCommand,
      transformResponse: bulkInviteUser.bulkInviteUserTransformResponse,
    }),
    getBulkInviteUserJobStatus: build.query<
      GetBulkInviteUserJobStatusCommandOutput,
      GetBulkInviteUserJobStatusCommandInput
    >({
      query: getBulkInviteUserJobStatus.getBulkInviteUserJobStatusCommand,
      transformResponse: getBulkInviteUserJobStatus.getBulkInviteUserJobStatusTransformResponse,
    }),
    resendInvite: build.mutation<string, ResendInviteCommandInput>({
      query: resendInvite.resendInviteCommand,
      transformResponse: resendInvite.resendInviteTransformResponse,
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
  useRegisterUserMutation,
  useBulkInviteUserMutation,
  useGetBulkInviteUserJobStatusQuery,
  useResendInviteMutation,
} = profileApi;
