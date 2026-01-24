// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  formatRoleName,
  formatStorageUsage,
  formatComputeUsage,
  formatProfileCreationDate,
  getRolePriority,
  sortProfilesByRoleAndName,
} from '../helpers';

describe('ProfilesTable helpers', () => {
  describe('formatRoleName', () => {
    it('should format admin role correctly', () => {
      render(<div data-testid="role">{formatRoleName('dr-admins')}</div>);
      const badge = screen.getByText('Admin');
      expect(badge).toBeInTheDocument();
    });

    it('should format race facilitator role correctly', () => {
      render(<div data-testid="role">{formatRoleName('dr-race-facilitators')}</div>);
      const badge = screen.getByText('Race facilitator');
      expect(badge).toBeInTheDocument();
    });

    it('should format racer role correctly', () => {
      render(<div data-testid="role">{formatRoleName('dr-racers')}</div>);
      expect(screen.getByText('Racer')).toBeInTheDocument();
    });

    it('should return the original role name for unknown roles', () => {
      const unknownRole = 'unknown-role';
      render(<div data-testid="role">{formatRoleName(unknownRole)}</div>);
      expect(screen.getByText(unknownRole)).toBeInTheDocument();
    });

    it('should handle undefined role name', () => {
      const result = formatRoleName(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('formatStorageUsage', () => {
    it('should format storage usage correctly in GB', () => {
      const storageUsage = 2 * 1024 * 1024 * 1024;
      const result = formatStorageUsage(storageUsage);
      expect(result).toBe('2.00 GB');
    });

    it('should format storage usage with decimal places', () => {
      const storageUsage = 2.5 * 1024 * 1024 * 1024;
      const result = formatStorageUsage(storageUsage);
      expect(result).toBe('2.50 GB');
    });

    it('should handle zero storage usage', () => {
      const result = formatStorageUsage(0);
      expect(result).toBe('0.00 GB');
    });

    it('should handle undefined storage usage', () => {
      const result = formatStorageUsage(undefined);
      expect(result).toBe('-/-');
    });
  });

  describe('formatComputeUsage', () => {
    it('should format compute usage correctly in hours', () => {
      const computeUsage = 2 * 60;
      const result = formatComputeUsage(computeUsage);
      expect(result).toBe('2.00 hrs');
    });

    it('should format compute usage with decimal places', () => {
      const computeUsage = 2.5 * 60;
      const result = formatComputeUsage(computeUsage);
      expect(result).toBe('2.50 hrs');
    });

    it('should handle zero compute usage', () => {
      const result = formatComputeUsage(0);
      expect(result).toBe('0.00 hrs');
    });

    it('should handle undefined compute usage', () => {
      const result = formatComputeUsage(undefined);
      expect(result).toBe('-/-');
    });
  });

  describe('formatProfileCreationDate', () => {
    it('should format date string correctly', () => {
      const dateString = '2023-05-15T12:30:45.000Z';
      const result = formatProfileCreationDate(dateString);
      expect(result).toBe('2023-05-15');
    });

    it('should handle empty date string', () => {
      const result = formatProfileCreationDate('');
      expect(result).toBe('-/-');
    });

    it('should handle undefined date string', () => {
      const result = formatProfileCreationDate(undefined);
      expect(result).toBe('-/-');
    });
  });

  describe('getRolePriority', () => {
    it('should return priority 1 for admin role', () => {
      const result = getRolePriority('dr-admins');
      expect(result).toBe(1);
    });

    it('should return priority 2 for race facilitator role', () => {
      const result = getRolePriority('dr-race-facilitators');
      expect(result).toBe(2);
    });

    it('should return priority 3 for racer role', () => {
      const result = getRolePriority('dr-racers');
      expect(result).toBe(3);
    });

    it('should return priority 4 for unknown roles', () => {
      const result = getRolePriority('unknown-role');
      expect(result).toBe(4);
    });

    it('should handle undefined role', () => {
      const result = getRolePriority(undefined);
      expect(result).toBe(4);
    });
  });

  describe('sortProfilesByRoleAndName', () => {
    const mockProfiles: Profile[] = [
      { alias: 'Charlie', roleName: 'dr-racers', avatar: {}, profileId: '1' },
      { alias: 'Alice', roleName: 'dr-admins', avatar: {}, profileId: '2' },
      { alias: 'Eve', roleName: 'dr-race-facilitators', avatar: {}, profileId: '3' },
      { alias: 'Bob', roleName: 'dr-admins', avatar: {}, profileId: '4' },
      { alias: 'Dave', roleName: 'dr-racers', avatar: {}, profileId: '5' },
      { alias: 'Frank', roleName: 'dr-race-facilitators', avatar: {}, profileId: '6' },
      { alias: 'Grace', roleName: 'unknown-role', avatar: {}, profileId: '7' },
    ];

    it('should sort profiles by role priority first', () => {
      const result = sortProfilesByRoleAndName(mockProfiles);

      expect(result[0].roleName).toBe('dr-admins');
      expect(result[1].roleName).toBe('dr-admins');
      expect(result[2].roleName).toBe('dr-race-facilitators');
      expect(result[3].roleName).toBe('dr-race-facilitators');
      expect(result[4].roleName).toBe('dr-racers');
      expect(result[5].roleName).toBe('dr-racers');
      expect(result[6].roleName).toBe('unknown-role');
    });

    it('should sort profiles alphabetically within the same role', () => {
      const result = sortProfilesByRoleAndName(mockProfiles);

      // Check alphabetical sorting within each role group
      expect(result[0].alias).toBe('Alice'); // Admin
      expect(result[1].alias).toBe('Bob'); // Admin
      expect(result[2].alias).toBe('Eve'); // Race facilitator
      expect(result[3].alias).toBe('Frank'); // Race facilitator
      expect(result[4].alias).toBe('Charlie'); // Racer
      expect(result[5].alias).toBe('Dave'); // Racer
      expect(result[6].alias).toBe('Grace'); // Unknown role
    });

    it('should filter profiles based on filterText', () => {
      let result = sortProfilesByRoleAndName(mockProfiles, 'alice');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');

      result = sortProfilesByRoleAndName(mockProfiles, 'al');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');

      const profileWithMultipleWords: Profile = {
        alias: 'John Smith',
        roleName: 'dr-racers',
        avatar: {},
        profileId: '8',
      };
      result = sortProfilesByRoleAndName([...mockProfiles, profileWithMultipleWords], 'smith');
      expect(result.some((profile) => profile.alias === 'John Smith')).toBe(true);
    });

    it('should handle case insensitive filtering', () => {
      const result = sortProfilesByRoleAndName(mockProfiles, 'ALICE');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');
    });

    it('should return all profiles when filterText is empty', () => {
      const result = sortProfilesByRoleAndName(mockProfiles, '');
      expect(result.length).toBe(mockProfiles.length);
    });

    it('should handle undefined filterText', () => {
      const result = sortProfilesByRoleAndName(mockProfiles, undefined);
      expect(result.length).toBe(mockProfiles.length);
    });

    it('should handle empty profiles array', () => {
      const result = sortProfilesByRoleAndName([]);
      expect(result).toEqual([]);
    });

    it('should handle profiles with undefined roleName', () => {
      const profilesWithUndefinedRole: Profile[] = [
        { alias: 'Unknown', avatar: {}, profileId: '11' },
        { alias: 'Alice', roleName: 'dr-admins', avatar: {}, profileId: '12' },
      ];

      const result = sortProfilesByRoleAndName(profilesWithUndefinedRole);

      expect(result[0].alias).toBe('Alice');
      expect(result[1].alias).toBe('Unknown');
    });

    it('should handle profiles with undefined alias when filtering', () => {
      const mixedProfiles: Profile[] = [
        { alias: 'Alice', roleName: 'dr-admins', avatar: {}, profileId: '13' },
        { roleName: 'dr-admins', avatar: {}, profileId: '14' } as Profile,
        { alias: 'Bob', roleName: 'dr-admins', avatar: {}, profileId: '15' },
      ];

      const result = sortProfilesByRoleAndName(mixedProfiles, 'alice');

      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');

      const allResults = sortProfilesByRoleAndName(mixedProfiles, '');
      expect(allResults.length).toBe(3);

      const noFilterResults = sortProfilesByRoleAndName(mixedProfiles);
      expect(noFilterResults.length).toBe(3);

      expect(noFilterResults[0].alias).toBeUndefined();
    });

    it('should filter profiles by email address', () => {
      const profilesWithEmails: Profile[] = [
        { alias: 'Alice', emailAddress: 'alice@example.com', roleName: 'dr-admins', avatar: {}, profileId: '16' },
        { alias: 'Bob', emailAddress: 'bob@example.com', roleName: 'dr-racers', avatar: {}, profileId: '17' },
        { alias: 'Charlie', emailAddress: 'charlie@company.org', roleName: 'dr-racers', avatar: {}, profileId: '18' },
      ];

      // Test exact email search
      let result = sortProfilesByRoleAndName(profilesWithEmails, 'alice@example.com');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');

      // Test prefix email search
      result = sortProfilesByRoleAndName(profilesWithEmails, 'bob@');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Bob');

      // Test domain search
      result = sortProfilesByRoleAndName(profilesWithEmails, 'example.com');
      expect(result.length).toBe(2);
      expect(result.some((p) => p.alias === 'Alice')).toBe(true);
      expect(result.some((p) => p.alias === 'Bob')).toBe(true);
    });

    it('should handle case insensitive email filtering', () => {
      const profilesWithEmails: Profile[] = [
        { alias: 'Alice', emailAddress: 'alice@Example.COM', roleName: 'dr-admins', avatar: {}, profileId: '19' },
        { alias: 'Bob', emailAddress: 'BOB@example.com', roleName: 'dr-racers', avatar: {}, profileId: '20' },
      ];

      const result = sortProfilesByRoleAndName(profilesWithEmails, 'ALICE@EXAMPLE.COM');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');

      const domainResult = sortProfilesByRoleAndName(profilesWithEmails, 'EXAMPLE.COM');
      expect(domainResult.length).toBe(2);
    });

    it('should handle profiles with undefined email addresses when filtering', () => {
      const mixedEmailProfiles: Profile[] = [
        { alias: 'Alice', emailAddress: 'alice@example.com', roleName: 'dr-admins', avatar: {}, profileId: '21' },
        { alias: 'Bob', roleName: 'dr-racers', avatar: {}, profileId: '22' },
        { alias: 'Charlie', emailAddress: 'charlie@example.com', roleName: 'dr-racers', avatar: {}, profileId: '23' },
      ];

      // Should find Alice by email
      let result = sortProfilesByRoleAndName(mixedEmailProfiles, 'alice@example.com');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Alice');

      // Should find Bob by alias even though he has no email
      result = sortProfilesByRoleAndName(mixedEmailProfiles, 'bob');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('Bob');

      // Should find both Alice and Charlie by domain
      result = sortProfilesByRoleAndName(mixedEmailProfiles, 'example.com');
      expect(result.length).toBe(2);
      expect(result.some((p) => p.alias === 'Alice')).toBe(true);
      expect(result.some((p) => p.alias === 'Charlie')).toBe(true);
    });

    it('should match both alias and email in the same search', () => {
      const profilesWithBoth: Profile[] = [
        { alias: 'alice', emailAddress: 'alice@example.com', roleName: 'dr-admins', avatar: {}, profileId: '24' },
        { alias: 'Bob Smith', emailAddress: 'bob@company.org', roleName: 'dr-racers', avatar: {}, profileId: '25' },
        { alias: 'charlie', emailAddress: 'charlie@example.com', roleName: 'dr-racers', avatar: {}, profileId: '26' },
      ];

      // Search term that matches Alice's alias and Charlie's email
      const result = sortProfilesByRoleAndName(profilesWithBoth, 'alice');
      expect(result.length).toBe(1);
      expect(result[0].alias).toBe('alice');

      // Search term that could match Bob's alias or any email domain
      const domainResult = sortProfilesByRoleAndName(profilesWithBoth, 'example');
      expect(domainResult.length).toBe(2);
      expect(domainResult.some((p) => p.alias === 'alice')).toBe(true);
      expect(domainResult.some((p) => p.alias === 'charlie')).toBe(true);
    });
  });
});
