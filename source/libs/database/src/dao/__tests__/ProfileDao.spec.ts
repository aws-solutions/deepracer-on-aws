// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { vi } from 'vitest';

import { TEST_PROFILE_ITEM, TEST_NAMESPACE } from '../../constants/testConstants.js';
import { ProfilesEntity } from '../../entities/ProfilesEntity.js';
import { ProfileDao } from '../ProfileDao.js';

vi.mock('@deepracer-indy/config');

const mockConfig = vi.mocked(deepRacerIndyAppConfig);

const mockProfilesEntity = vi.hoisted(() => ({
  create: vi.fn(),
  query: {
    bySortKey: vi.fn(),
  },
}));

vi.mock('#entities/ProfilesEntity.js', () => ({
  ProfilesEntity: mockProfilesEntity,
}));

describe('ProfileDao', () => {
  let profileDao: ProfileDao;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig.dynamoDB = {
      tableName: `${TEST_NAMESPACE}-DeepRacerIndy.Main` as const,
      resourceIdLength: 15,
    };

    profileDao = new ProfileDao(ProfilesEntity);
  });

  describe('list', () => {
    it('should query profiles and return data', async () => {
      const mockElectroResponse = {
        data: [
          {
            profileId: 'profile-1',
            alias: 'User One',
            avatar: { top: 'Helmet' },
            computeMinutesUsed: 0,
            computeMinutesQueued: 0,
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
            version: 1,
          },
        ],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await profileDao.list({ maxResults: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        profileId: 'profile-1',
        alias: 'User One',
        avatar: { top: 'Helmet' },
        computeMinutesUsed: 0,
        computeMinutesQueued: 0,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: 1,
      });
      expect(result.cursor).toBeNull();
    });

    it('should handle empty results', async () => {
      const mockElectroResponse = {
        data: [],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await profileDao.list({ maxResults: 25 });

      expect(result).toEqual({
        data: [],
        cursor: null,
      });
    });

    it('should handle pagination cursor', async () => {
      const mockCursor = { pk: 'test', sk: 'token' };
      const expectedCursor = Buffer.from(JSON.stringify(mockCursor)).toString('base64');

      const mockElectroResponse = {
        data: [
          {
            profileId: 'profile-1',
            alias: 'User One',
            avatar: { top: 'Helmet' },
            computeMinutesUsed: 0,
            computeMinutesQueued: 0,
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
            version: 1,
          },
        ],
        cursor: mockCursor,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      const result = await profileDao.list({ maxResults: 25 });

      expect(result.cursor).toBe(expectedCursor);
      expect(result.data).toHaveLength(1);
    });

    it('should parse and pass cursor when provided', async () => {
      const inputCursor = { pk: 'profiles', sk: 'profile_abc' };
      const inputCursorString = Buffer.from(JSON.stringify(inputCursor)).toString('base64');

      const mockElectroResponse = {
        data: [
          {
            profileId: 'profile-2',
            alias: 'User Two',
            avatar: { top: 'Cap' },
            computeMinutesUsed: 5,
            computeMinutesQueued: 10,
            createdAt: '2023-01-02T00:00:00.000Z',
            updatedAt: '2023-01-02T00:00:00.000Z',
            version: 1,
          },
        ],
        cursor: null,
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.query.bySortKey.mockReturnValue({ go: mockGo });

      await profileDao.list({ cursor: inputCursorString, maxResults: 10 });

      expect(mockGo).toHaveBeenCalledWith({
        limit: 10,
        cursor: inputCursor,
      });
    });
  });

  describe('create', () => {
    it('should create a profile and return the profile data', async () => {
      const createInput = {
        alias: 'Test User',
        avatar: { top: 'Helmet' },
      };

      const mockElectroResponse = {
        data: {
          ...TEST_PROFILE_ITEM,
          ...createInput,
        },
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.create.mockReturnValue({ go: mockGo });

      const result = await profileDao.create(createInput);

      expect(mockProfilesEntity.create).toHaveBeenCalledWith(createInput);
      expect(mockGo).toHaveBeenCalled();
      expect(result).toEqual({
        ...TEST_PROFILE_ITEM,
        ...createInput,
      });
    });

    it('should handle create errors', async () => {
      const createInput = {
        alias: 'Test User',
        avatar: { top: 'Helmet' },
      };

      const error = new Error('Create failed');
      const mockGo = vi.fn().mockRejectedValue(error);
      mockProfilesEntity.create.mockReturnValue({ go: mockGo });

      await expect(profileDao.create(createInput)).rejects.toThrow('Create failed');
      expect(mockProfilesEntity.create).toHaveBeenCalledWith(createInput);
    });

    it('should pass through all create parameters to the entity', async () => {
      const createInput = {
        alias: 'Test User',
        avatar: { top: 'Helmet', body: 'Shirt' },
        roleName: 'TestRole',
        computeMinutesUsed: 0,
        computeMinutesQueued: 0,
        maxTotalComputeMinutes: 100,
        maxModelCount: 10,
      };

      const mockElectroResponse = {
        data: {
          ...TEST_PROFILE_ITEM,
          ...createInput,
        },
      };

      const mockGo = vi.fn().mockResolvedValue(mockElectroResponse);
      mockProfilesEntity.create.mockReturnValue({ go: mockGo });

      const result = await profileDao.create(createInput);

      expect(mockProfilesEntity.create).toHaveBeenCalledWith(createInput);
      expect(result).toEqual({
        ...TEST_PROFILE_ITEM,
        ...createInput,
      });
    });
  });
});
