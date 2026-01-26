// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AvatarConfig,
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
  ListProfilesCommandOutput,
  Profile,
  UpdateGroupMembershipCommand,
  UpdateGroupMembershipCommandInput,
  UpdateGroupMembershipCommandOutput,
  UpdateProfileCommand,
  UpdateProfileCommandInput,
  UpdateProfileCommandOutput,
  UserGroups,
} from '@deepracer-indy/typescript-client';
import { describe, it, expect } from 'vitest';

import * as profileApiModule from '#services/deepRacer/profileApi';

describe('profileApi', () => {
  describe('createProfileCommand', () => {
    it('should create a CreateProfileCommand with input', () => {
      const input: CreateProfileCommandInput = {
        emailAddress: 'test@example.com',
      };

      const result = profileApiModule.createProfile.createProfileCommand(input);

      expect(result.command).toBeInstanceOf(CreateProfileCommand);
      expect(result.command.input).toEqual(input);
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

  describe('listProfilesCommand', () => {
    it('should create a ListProfilesCommand', () => {
      const result = profileApiModule.listProfiles.listProfilesCommand();

      expect(result.command).toBeInstanceOf(ListProfilesCommand);
      expect(result.displayNotificationOnError).toBe(false);
    });
  });

  describe('listProfilesTransformResponse', () => {
    it('should transform response to profiles array', () => {
      const mockProfiles: Profile[] = [
        {
          profileId: 'profile-1',
          alias: 'User1',
          roleName: 'dr-racers',
          avatar: 'avatar1' as AvatarConfig,
        },
        {
          profileId: 'profile-2',
          alias: 'User2',
          roleName: 'dr-racers',
          avatar: 'avatar2' as AvatarConfig,
        },
      ];

      const mockResponse: ListProfilesCommandOutput = {
        $metadata: {},
        profiles: mockProfiles,
      };

      const result = profileApiModule.listProfiles.listProfilesTransformResponse(mockResponse);

      expect(result).toEqual(mockProfiles);
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
