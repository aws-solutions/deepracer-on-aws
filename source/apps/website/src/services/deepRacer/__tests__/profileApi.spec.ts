// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AvatarConfig,
  BatchUpdateProfileQuotasCommand,
  BatchUpdateProfileQuotasCommandInput,
  CreateProfileCommand,
  CreateProfileCommandInput,
  CreateProfileCommandOutput,
  DeleteProfileCommand,
  DeleteProfileCommandInput,
  DeleteProfileCommandOutput,
  DeleteProfileModelsCommand,
  DeleteProfileModelsCommandInput,
  DeleteProfileModelsCommandOutput,
  ListProfilesCommand,
  Profile,
  UpdateGroupMembershipCommand,
  UpdateGroupMembershipCommandInput,
  UpdateGroupMembershipCommandOutput,
  UpdateProfileCommand,
  UpdateProfileCommandInput,
  UpdateProfileCommandOutput,
  UserGroups,
} from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import * as profileApiModule from '#services/deepRacer/profileApi';
import { mockDeepRacerClient } from '#utils/testUtils';

describe('profileApi', () => {
  describe('createProfileCommand', () => {
    it('should create a CreateProfileCommand with input', () => {
      const input: CreateProfileCommandInput = {
        emailAddress: 'test@example.com',
      };

      const result = profileApiModule.createProfile.createProfileCommand(input);

      expect(result.command).toBeInstanceOf(CreateProfileCommand);
      expect(result.command.input).toEqual(input);
      expect(result.displayNotificationOnError).toBe(false);
    });
  });

  describe('createProfileTransformResponse', () => {
    it('should transform response to message string', () => {
      const mockMessage = 'Profile created successfully';
      const mockResponse: CreateProfileCommandOutput = {
        $metadata: {},
        message: mockMessage,
      };

      const result = profileApiModule.createProfile.createProfileTransformResponse(mockResponse);

      expect(result).toBe(mockMessage);
    });
  });

  describe('deleteProfileCommand', () => {
    it('should create a DeleteProfileCommand with input', () => {
      const input: DeleteProfileCommandInput = {
        profileId: 'test-profile-id',
      };

      const result = profileApiModule.deleteProfile.deleteProfileCommand(input);

      expect(result.command).toBeInstanceOf(DeleteProfileCommand);
      expect(result.command.input).toEqual(input);
      expect(result.displayNotificationOnError).toBe(false);
    });
  });

  describe('deleteProfileTransformResponse', () => {
    it('should transform response to undefined', () => {
      const mockResponse: DeleteProfileCommandOutput = {
        $metadata: {},
      };

      const result = profileApiModule.deleteProfile.deleteProfileTransformResponse(mockResponse);

      expect(result).toBeUndefined();
    });
  });

  describe('deleteProfileModelsCommand', () => {
    it('should create a DeleteProfileModelsCommand with input', () => {
      const input: DeleteProfileModelsCommandInput = {
        profileId: 'test-profile-id',
      };

      const result = profileApiModule.deleteProfileModels.deleteProfileModelsCommand(input);

      expect(result.command).toBeInstanceOf(DeleteProfileModelsCommand);
      expect(result.command.input).toEqual(input);
      expect(result.displayNotificationOnError).toBe(false);
    });
  });

  describe('deleteProfileModelsTransformResponse', () => {
    it('should transform response to undefined', () => {
      const mockResponse: DeleteProfileModelsCommandOutput = {
        $metadata: {},
      };

      const result = profileApiModule.deleteProfileModels.deleteProfileModelsTransformResponse(mockResponse);

      expect(result).toBeUndefined();
    });
  });

  describe('deleteProfile endpoint', () => {
    it('should have deleteProfile endpoint defined', () => {
      expect(profileApiModule.profileApi.endpoints.deleteProfile).toBeDefined();
    });

    it('should export useDeleteProfileMutation hook', () => {
      expect(profileApiModule.profileApi.useDeleteProfileMutation).toBeDefined();
      expect(typeof profileApiModule.profileApi.useDeleteProfileMutation).toBe('function');
    });
  });

  describe('updateProfileCommand', () => {
    it('should create an UpdateProfileCommand with input', () => {
      const input: UpdateProfileCommandInput = {
        alias: 'UpdatedAlias',
      };

      const result = profileApiModule.updateProfile.updateProfileCommand(input);

      expect(result.command).toBeInstanceOf(UpdateProfileCommand);
      expect(result.command.input).toEqual(input);
    });
  });

  describe('updateProfileTransformResponse', () => {
    it('should transform response to profile', () => {
      const mockProfile: Profile = {
        profileId: 'test-profile-id',
        alias: 'UpdatedUser',
        roleName: 'dr-racers',
        avatar: 'avatar' as AvatarConfig,
      };

      const mockResponse: UpdateProfileCommandOutput = {
        $metadata: {},
        profile: mockProfile,
      };

      const result = profileApiModule.updateProfile.updateProfileTransformResponse(mockResponse);

      expect(result).toEqual(mockProfile);
    });
  });

  describe('deleteProfileModels endpoint', () => {
    it('should have deleteProfileModels endpoint defined', () => {
      expect(profileApiModule.profileApi.endpoints.deleteProfileModels).toBeDefined();
    });

    it('should export useDeleteProfileModelsMutation hook', () => {
      expect(profileApiModule.profileApi.useDeleteProfileModelsMutation).toBeDefined();
      expect(typeof profileApiModule.profileApi.useDeleteProfileModelsMutation).toBe('function');
    });
  });

  describe('listProfiles endpoint', () => {
    it('should have listProfiles endpoint defined', () => {
      expect(profileApiModule.profileApi.endpoints.listProfiles).toBeDefined();
    });

    it('should export useListProfilesQuery hook', () => {
      expect(profileApiModule.profileApi.useListProfilesQuery).toBeDefined();
      expect(typeof profileApiModule.profileApi.useListProfilesQuery).toBe('function');
    });
  });

  describe('createProfile endpoint', () => {
    it('should have createProfile endpoint defined', () => {
      expect(profileApiModule.profileApi.endpoints.createProfile).toBeDefined();
    });

    it('should export useCreateProfileMutation hook', () => {
      expect(profileApiModule.profileApi.useCreateProfileMutation).toBeDefined();
      expect(typeof profileApiModule.profileApi.useCreateProfileMutation).toBe('function');
    });
  });

  describe('batchUpdateProfileQuotasCommand', () => {
    it('should create a BatchUpdateProfileQuotasCommand with input and no generic error notification', () => {
      const input: BatchUpdateProfileQuotasCommandInput = {
        profileIds: ['profileAAAAAAAA', 'profileBBBBBBBB'],
        maxTotalComputeMinutes: 1200,
        maxModelCount: -1,
      };

      const result = profileApiModule.batchUpdateProfileQuotas.batchUpdateProfileQuotasCommand(input);

      expect(result.command).toBeInstanceOf(BatchUpdateProfileQuotasCommand);
      expect(result.command.input).toEqual(input);
      expect(result.displayNotificationOnError).toBe(false);
    });
  });

  describe('batchUpdateProfileQuotas endpoint', () => {
    const { profileApi } = profileApiModule;
    const input: BatchUpdateProfileQuotasCommandInput = {
      profileIds: ['profileAAAAAAAA', 'profileBBBBBBBB'],
      maxTotalComputeMinutes: 1200,
      maxModelCount: -1,
    };
    const dispatchedActionTypes = (state: string[] = [], action: { type: string }) => [...state, action.type];
    const store = configureStore({
      reducer: { [profileApi.reducerPath]: profileApi.reducer, dispatchedActionTypes },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(profileApi.middleware),
    });

    beforeEach(() => {
      mockDeepRacerClient.reset();
      store.dispatch(profileApi.util.resetApiState());
    });

    it('should send the command with the input and return the updated IDs and per-profile errors', async () => {
      const errors = [{ profileId: 'profileBBBBBBBB', code: 'NotFoundError', message: 'Profile not found.' }];
      mockDeepRacerClient
        .on(BatchUpdateProfileQuotasCommand)
        .resolvesOnce({ updatedProfileIds: ['profileAAAAAAAA'], errors });

      const result = await store.dispatch(profileApi.endpoints.batchUpdateProfileQuotas.initiate(input)).unwrap();

      expect(result.updatedProfileIds).toEqual(['profileAAAAAAAA']);
      expect(result.errors).toEqual(errors);
      const calls = mockDeepRacerClient.commandCalls(BatchUpdateProfileQuotasCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual(input);
    });

    it('should refetch the profile list after a successful update', async () => {
      mockDeepRacerClient.on(ListProfilesCommand).resolves({ profiles: [] });
      mockDeepRacerClient
        .on(BatchUpdateProfileQuotasCommand)
        .resolves({ updatedProfileIds: input.profileIds, errors: [] });
      const subscription = store.dispatch(profileApi.endpoints.listProfiles.initiate());
      await subscription;
      expect(mockDeepRacerClient.commandCalls(ListProfilesCommand)).toHaveLength(1);

      await store.dispatch(profileApi.endpoints.batchUpdateProfileQuotas.initiate(input)).unwrap();

      await vi.waitFor(() => {
        expect(mockDeepRacerClient.commandCalls(ListProfilesCommand)).toHaveLength(2);
      });
      subscription.unsubscribe();
    });

    it('should reject without raising the generic API error notification, leaving the message to the modal', async () => {
      mockDeepRacerClient.on(BatchUpdateProfileQuotasCommand).rejectsOnce(new Error('Not authorized'));

      await expect(
        store.dispatch(profileApi.endpoints.batchUpdateProfileQuotas.initiate(input)).unwrap(),
      ).rejects.toBeDefined();

      expect(store.getState().dispatchedActionTypes).not.toContain('notifications/displayErrorNotification');
    });
  });

  describe('updateProfile endpoint', () => {
    it('should have updateProfile endpoint defined', () => {
      expect(profileApiModule.profileApi.endpoints.updateProfile).toBeDefined();
    });

    it('should export useUpdateProfileMutation hook', () => {
      expect(profileApiModule.profileApi.useUpdateProfileMutation).toBeDefined();
      expect(typeof profileApiModule.profileApi.useUpdateProfileMutation).toBe('function');
    });
  });

  describe('updateGroupMembershipCommand', () => {
    it('should create an UpdateGroupMembershipCommand with input', () => {
      const input: UpdateGroupMembershipCommandInput = {
        profileId: 'test-profile-id',
        targetUserPoolGroup: UserGroups.ADMIN,
      };

      const result = profileApiModule.updateGroupMembership.updateGroupMembershipCommand(input);

      expect(result.command).toBeInstanceOf(UpdateGroupMembershipCommand);
      expect(result.command.input).toEqual(input);
      expect(result.displayNotificationOnError).toBe(false);
    });

    it('should create command with RACERS group', () => {
      const input: UpdateGroupMembershipCommandInput = {
        profileId: 'racer-profile-id',
        targetUserPoolGroup: UserGroups.RACERS,
      };

      const result = profileApiModule.updateGroupMembership.updateGroupMembershipCommand(input);

      expect(result.command).toBeInstanceOf(UpdateGroupMembershipCommand);
      expect(result.command.input.targetUserPoolGroup).toBe(UserGroups.RACERS);
    });

    it('should create command with RACE_FACILITATORS group', () => {
      const input: UpdateGroupMembershipCommandInput = {
        profileId: 'facilitator-profile-id',
        targetUserPoolGroup: UserGroups.RACE_FACILITATORS,
      };

      const result = profileApiModule.updateGroupMembership.updateGroupMembershipCommand(input);

      expect(result.command).toBeInstanceOf(UpdateGroupMembershipCommand);
      expect(result.command.input.targetUserPoolGroup).toBe(UserGroups.RACE_FACILITATORS);
    });
  });

  describe('updateGroupMembershipTransformResponse', () => {
    it('should transform response to undefined', () => {
      const mockResponse: UpdateGroupMembershipCommandOutput = {
        $metadata: {},
      };

      const result = profileApiModule.updateGroupMembership.updateGroupMembershipTransformResponse(mockResponse);

      expect(result).toBeUndefined();
    });

    it('should handle response with additional metadata', () => {
      const mockResponse: UpdateGroupMembershipCommandOutput = {
        $metadata: {
          httpStatusCode: 200,
          requestId: 'test-request-id',
        },
      };

      const result = profileApiModule.updateGroupMembership.updateGroupMembershipTransformResponse(mockResponse);

      expect(result).toBeUndefined();
    });
  });

  describe('updateGroupMembership endpoint', () => {
    it('should have updateGroupMembership endpoint defined', () => {
      expect(profileApiModule.profileApi.endpoints.updateGroupMembership).toBeDefined();
    });

    it('should export useUpdateGroupMembershipMutation hook', () => {
      expect(profileApiModule.profileApi.useUpdateGroupMembershipMutation).toBeDefined();
      expect(typeof profileApiModule.profileApi.useUpdateGroupMembershipMutation).toBe('function');
    });
  });

  describe('updateGroupMembership integration', () => {
    it('should handle all user group types', () => {
      const userGroups = [UserGroups.RACERS, UserGroups.RACE_FACILITATORS, UserGroups.ADMIN];

      userGroups.forEach((group) => {
        const input: UpdateGroupMembershipCommandInput = {
          profileId: `test-profile-${group}`,
          targetUserPoolGroup: group,
        };

        const result = profileApiModule.updateGroupMembership.updateGroupMembershipCommand(input);

        expect(result.command).toBeInstanceOf(UpdateGroupMembershipCommand);
        expect(result.command.input.targetUserPoolGroup).toBe(group);
        expect(result.command.input.profileId).toBe(`test-profile-${group}`);
      });
    });

    it('should maintain input structure integrity', () => {
      const input: UpdateGroupMembershipCommandInput = {
        profileId: 'integrity-test-profile',
        targetUserPoolGroup: UserGroups.ADMIN,
      };

      const result = profileApiModule.updateGroupMembership.updateGroupMembershipCommand(input);

      expect(input.profileId).toBe('integrity-test-profile');
      expect(input.targetUserPoolGroup).toBe(UserGroups.ADMIN);

      expect(result.command.input).toEqual(input);
      expect(result.command.input.profileId).toBe('integrity-test-profile');
      expect(result.command.input.targetUserPoolGroup).toBe(UserGroups.ADMIN);
    });
  });
});
