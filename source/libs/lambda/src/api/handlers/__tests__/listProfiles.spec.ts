// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_MAX_QUERY_RESULTS, ProfileItem, TEST_PROFILE_ITEM, profileDao } from '@deepracer-indy/database';
import { generateResourceId } from '@deepracer-indy/database/src/utils/resourceUtils';
import { vi } from 'vitest';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListProfilesOperation } from '../listProfiles.js';

// Mock the profileDao
vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    profileDao: {
      list: vi.fn(),
    },
  };
});

const mockProfileDao = vi.mocked(profileDao);

describe('ListProfiles operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful operations', () => {
    it('should return a list of profiles without pagination token', async () => {
      const mockProfiles: ProfileItem[] = [
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'User One',
        },
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'User Two',
        },
      ];

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: null,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result).toEqual({
        profiles: mockProfiles,
        token: undefined,
      });

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: undefined,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should return a list of profiles with pagination token', async () => {
      const mockProfiles: ProfileItem[] = [
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'User One',
        },
      ];
      const nextToken = 'eyJpZCI6eyJTIjoicHJvZmlsZS0xIn19'; // Base64 encoded token

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: nextToken,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result).toEqual({
        profiles: mockProfiles,
        token: nextToken,
      });

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: undefined,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should return empty array when no profiles exist', async () => {
      mockProfileDao.list.mockResolvedValue({
        data: [],
        cursor: null,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result).toEqual({
        profiles: [],
        token: undefined,
      });

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: undefined,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should pass input token directly as cursor', async () => {
      const inputToken = 'eyJpZCI6eyJTIjoicHJvZmlsZS0xIn19';
      const mockProfiles: ProfileItem[] = [
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'User Two',
        },
      ];

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: null,
      });

      const result = await ListProfilesOperation({ token: inputToken }, TEST_OPERATION_CONTEXT);

      expect(result).toEqual({
        profiles: mockProfiles,
        token: undefined,
      });

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: inputToken,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should handle multiple profiles with various data', async () => {
      const mockProfiles: ProfileItem[] = [
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'Admin User',
          avatar: {
            top: 'admin-top',
            clothing: 'admin-clothing',
            clothingColor: 'admin-color',
          },
        },
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'Regular User',
          avatar: {
            top: 'user-top',
            clothing: 'user-clothing',
            clothingColor: 'user-color',
          },
        },
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'Test User',
          avatar: {
            top: 'test-top',
            clothing: 'test-clothing',
            clothingColor: 'test-color',
          },
        },
      ];

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: null,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result.profiles).toHaveLength(3);
      expect(result.profiles[0].alias).toBe('Admin User');
      expect(result.profiles[1].alias).toBe('Regular User');
      expect(result.profiles[2].alias).toBe('Test User');
      expect(result.token).toBeUndefined();

      // Verify each profile has the expected structure
      result.profiles.forEach((profile) => {
        expect(profile).toHaveProperty('profileId');
        expect(profile).toHaveProperty('alias');
        expect(profile).toHaveProperty('avatar');
        expect(profile).toHaveProperty('createdAt');
        expect(profile).toHaveProperty('updatedAt');
      });
    });
  });

  describe('pagination scenarios', () => {
    it('should handle first page of paginated results', async () => {
      const mockProfiles: ProfileItem[] = Array.from({ length: 25 }, (_, i) => ({
        ...TEST_PROFILE_ITEM,
        profileId: generateResourceId(),
        alias: `User ${i + 1}`,
      }));
      const nextToken = 'eyJpZCI6eyJTIjoicHJvZmlsZS0yNSJ9fQ==';

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: nextToken,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result.profiles).toHaveLength(25);
      expect(result.token).toBe(nextToken);
      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: undefined,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should pass token directly as cursor for subsequent pages', async () => {
      const inputToken = 'eyJpZCI6eyJTIjoicHJvZmlsZS0yNSJ9fQ==';
      const mockProfiles: ProfileItem[] = Array.from({ length: 10 }, (_, i) => ({
        ...TEST_PROFILE_ITEM,
        profileId: generateResourceId(),
        alias: `User ${i + 26}`,
      }));

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: null,
      });

      const result = await ListProfilesOperation({ token: inputToken }, TEST_OPERATION_CONTEXT);

      expect(result.profiles).toHaveLength(10);
      expect(result.token).toBeUndefined();
      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: inputToken,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should pass token directly as cursor for empty pages', async () => {
      const inputToken = 'eyJpZCI6eyJTIjoicHJvZmlsZS0xMDAifX0=';

      mockProfileDao.list.mockResolvedValue({
        data: [],
        cursor: null,
      });

      const result = await ListProfilesOperation({ token: inputToken }, TEST_OPERATION_CONTEXT);

      expect(result.profiles).toHaveLength(0);
      expect(result.token).toBeUndefined();
      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: inputToken,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });
  });

  describe('configuration and filtering', () => {
    it('should use correct parameters for profileDao.list', async () => {
      const mockProfiles: ProfileItem[] = [
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'Custom User',
        },
      ];

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: null,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result).toEqual({
        profiles: mockProfiles,
        token: undefined,
      });

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: undefined,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should return profiles as provided by DAO', async () => {
      const mockProfiles: ProfileItem[] = [
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'Valid User',
        },
        {
          ...TEST_PROFILE_ITEM,
          profileId: generateResourceId(),
          alias: 'Another Valid User',
        },
      ];

      mockProfileDao.list.mockResolvedValue({
        data: mockProfiles,
        cursor: null,
      });

      const result = await ListProfilesOperation({}, TEST_OPERATION_CONTEXT);

      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].alias).toBe('Valid User');
      expect(result.profiles[1].alias).toBe('Another Valid User');
      expect(result.token).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockProfileDao.list.mockRejectedValue(dbError);

      await expect(ListProfilesOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow('Database connection failed');

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: undefined,
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('ServiceUnavailableException');
      serviceError.name = 'ServiceUnavailableException';
      mockProfileDao.list.mockRejectedValue(serviceError);

      await expect(ListProfilesOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow('ServiceUnavailableException');
    });

    it('should pass invalid token directly and propagate DAO errors', async () => {
      const invalidTokenError = new Error('Invalid pagination token: Unexpected token');
      mockProfileDao.list.mockRejectedValue(invalidTokenError);

      await expect(ListProfilesOperation({ token: 'invalid-token' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
        'Invalid pagination token: Unexpected token',
      );

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        cursor: 'invalid-token',
        maxResults: DEFAULT_MAX_QUERY_RESULTS,
      });
    });
  });
});
