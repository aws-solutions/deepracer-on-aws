// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig, Profile, UserGroups } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { RoleOption } from '../constants';
import { getCurrentRole } from '../helpers';

const testRoleOptions: RoleOption[] = [
  { label: 'Racer', value: UserGroups.RACERS },
  { label: 'Race facilitator', value: UserGroups.RACE_FACILITATORS },
  { label: 'Commentator', value: UserGroups.COMMENTATORS },
  { label: 'Registration manager', value: UserGroups.REGISTRATION_MANAGERS },
  { label: 'Admin', value: UserGroups.ADMIN },
];

describe('ChangeUserRoleModal helpers', () => {
  describe('getCurrentRole', () => {
    const mockAvatar: AvatarConfig = {
      color: 'blue',
      icon: 'user',
    } as AvatarConfig;

    const createMockProfile = (roleName?: string): Profile => ({
      profileId: 'test-profile-id',
      alias: 'testuser',
      avatar: mockAvatar,
      roleName,
    });

    it('should return null when selectedUser is null', () => {
      const result = getCurrentRole(null, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should return null when selectedUser has no roleName', () => {
      const user = createMockProfile();
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should return null when selectedUser has undefined roleName', () => {
      const user = createMockProfile(undefined);
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should return null when selectedUser has empty string roleName', () => {
      const user = createMockProfile('');
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should return correct role option for dr-racers role', () => {
      const user = createMockProfile('dr-racers');
      const result = getCurrentRole(user, testRoleOptions);

      expect(result).toEqual({
        label: 'Racer',
        value: UserGroups.RACERS,
      });
    });

    it('should return correct role option for dr-race-facilitators role', () => {
      const user = createMockProfile('dr-race-facilitators');
      const result = getCurrentRole(user, testRoleOptions);

      expect(result).toEqual({
        label: 'Race facilitator',
        value: UserGroups.RACE_FACILITATORS,
      });
    });

    it('should return correct role option for dr-commentators role', () => {
      const user = createMockProfile('dr-commentators');
      const result = getCurrentRole(user, testRoleOptions);

      expect(result).toEqual({
        label: 'Commentator',
        value: UserGroups.COMMENTATORS,
      });
    });

    it('should return correct role option for dr-registration-managers role', () => {
      const user = createMockProfile('dr-registration-managers');
      const result = getCurrentRole(user, testRoleOptions);

      expect(result).toEqual({
        label: 'Registration manager',
        value: UserGroups.REGISTRATION_MANAGERS,
      });
    });

    it('should return correct role option for dr-admins role', () => {
      const user = createMockProfile('dr-admins');
      const result = getCurrentRole(user, testRoleOptions);

      expect(result).toEqual({
        label: 'Admin',
        value: UserGroups.ADMIN,
      });
    });

    it('should return null for unknown role name', () => {
      const user = createMockProfile('unknown-role');
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should return null for invalid role name format', () => {
      const user = createMockProfile('invalid-role-format');
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should handle role names with different casing', () => {
      const user = createMockProfile('DR-RACERS');
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should handle role names with extra whitespace', () => {
      const user = createMockProfile(' dr-racers ');
      const result = getCurrentRole(user, testRoleOptions);
      expect(result).toBeNull();
    });

    it('should work with minimal Profile object', () => {
      const minimalUser: Profile = {
        profileId: 'test-id',
        alias: 'test',
        avatar: mockAvatar,
        roleName: 'dr-admins',
      };

      const result = getCurrentRole(minimalUser, testRoleOptions);
      expect(result).toEqual({
        label: 'Admin',
        value: UserGroups.ADMIN,
      });
    });

    it('should handle Profile with additional properties', () => {
      const extendedUser: Profile = {
        profileId: 'test-id',
        alias: 'test',
        avatar: mockAvatar,
        roleName: 'dr-race-facilitators',
        email: 'test@example.com',
        createdAt: '2023-01-01T00:00:00Z',
      } as Profile;

      const result = getCurrentRole(extendedUser, testRoleOptions);
      expect(result).toEqual({
        label: 'Race facilitator',
        value: UserGroups.RACE_FACILITATORS,
      });
    });

    it('should maintain referential equality for role options', () => {
      const user1 = createMockProfile('dr-racers');
      const user2 = createMockProfile('dr-racers');

      const result1 = getCurrentRole(user1, testRoleOptions);
      const result2 = getCurrentRole(user2, testRoleOptions);

      expect(result1).toEqual(result2);
      expect(result1?.value).toBe(UserGroups.RACERS);
      expect(result2?.value).toBe(UserGroups.RACERS);
    });

    it('should handle all valid role mappings consistently', () => {
      const testCases = [
        { roleName: 'dr-racers', expectedValue: UserGroups.RACERS, expectedLabel: 'Racer' },
        {
          roleName: 'dr-race-facilitators',
          expectedValue: UserGroups.RACE_FACILITATORS,
          expectedLabel: 'Race facilitator',
        },
        { roleName: 'dr-commentators', expectedValue: UserGroups.COMMENTATORS, expectedLabel: 'Commentator' },
        {
          roleName: 'dr-registration-managers',
          expectedValue: UserGroups.REGISTRATION_MANAGERS,
          expectedLabel: 'Registration manager',
        },
        { roleName: 'dr-admins', expectedValue: UserGroups.ADMIN, expectedLabel: 'Admin' },
      ];

      testCases.forEach(({ roleName, expectedValue, expectedLabel }) => {
        const user = createMockProfile(roleName);
        const result = getCurrentRole(user, testRoleOptions);

        expect(result).not.toBeNull();
        expect(result?.value).toBe(expectedValue);
        expect(result?.label).toBe(expectedLabel);
      });
    });
  });
});
