// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  profileDao,
  accountResourceUsageDao,
  TEST_PROFILE_ITEM,
  TEST_PROFILE_ID_2,
  TEST_PROFILE_ID_3,
  TEST_ACCOUNT_RESOURCE_USAGE_NORMAL,
  TEST_ACCOUNT_RESOURCE_USAGE_EMPTY,
  generateResourceId,
} from '@deepracer-indy/database';

import { usageQuotaHelper } from '../UsageQuotaHelper.js';

vi.mock('@deepracer-indy/database', async () => {
  const actual = await vi.importActual('@deepracer-indy/database');
  return {
    ...actual,
    profileDao: {
      load: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    },
    accountResourceUsageDao: {
      get: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock('@deepracer-indy/utils', async () => {
  const actual = await vi.importActual('@deepracer-indy/utils');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('UsageQuotaHelper', () => {
  const mockProfileDao = vi.mocked(profileDao);
  const mockAccountResourceUsageDao = vi.mocked(accountResourceUsageDao);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadProfileComputeUsage', () => {
    it('should load profile compute usage successfully', async () => {
      const mockProfile = {
        ...TEST_PROFILE_ITEM,
        computeMinutesQueued: 10,
        computeMinutesUsed: 5,
        maxTotalComputeMinutes: 100,
        modelCount: 2,
        maxModelCount: 10,
      };

      mockProfileDao.load.mockResolvedValue(mockProfile);

      const result = await usageQuotaHelper.loadProfileComputeUsage(TEST_PROFILE_ITEM.profileId);

      expect(result).toEqual(mockProfile);
      expect(mockProfileDao.load).toHaveBeenCalledWith({ profileId: TEST_PROFILE_ITEM.profileId });
    });

    it('should handle profile load errors', async () => {
      const error = new Error('Profile not found');
      mockProfileDao.load.mockRejectedValue(error);

      await expect(usageQuotaHelper.loadProfileComputeUsage(TEST_PROFILE_ITEM.profileId)).rejects.toThrow(
        'Profile not found',
      );
    });
  });

  describe('finalizeProfileComputeUsage', () => {
    it('should finalize profile compute usage with normal values', async () => {
      const mockProfile = {
        ...TEST_PROFILE_ITEM,
        computeMinutesQueued: 20,
        computeMinutesUsed: 10,
      };

      mockProfileDao.load.mockResolvedValue(mockProfile);

      await usageQuotaHelper.finalizeProfileComputeUsage(TEST_PROFILE_ITEM.profileId, 15, 12);

      expect(mockProfileDao.update).toHaveBeenCalledWith(
        { profileId: TEST_PROFILE_ITEM.profileId },
        {
          computeMinutesQueued: 5, // 20 - 15
          computeMinutesUsed: 22, // 10 + 12
        },
      );
    });

    it('should handle edge case where queued minutes is less than user minutes', async () => {
      const mockProfile = {
        ...TEST_PROFILE_ITEM,
        computeMinutesQueued: 5,
        computeMinutesUsed: 10,
      };

      mockProfileDao.load.mockResolvedValue(mockProfile);

      await usageQuotaHelper.finalizeProfileComputeUsage(TEST_PROFILE_ITEM.profileId, 10, 8);

      expect(mockProfileDao.update).toHaveBeenCalledWith(
        { profileId: TEST_PROFILE_ITEM.profileId },
        {
          computeMinutesQueued: 0, // max(5 - 10, 0) = 0
          computeMinutesUsed: 18, // 10 + 8
        },
      );
    });

    it('should use queued minutes when less than or equal to used minutes', async () => {
      const mockProfile = {
        ...TEST_PROFILE_ITEM,
        computeMinutesQueued: 20,
        computeMinutesUsed: 10,
      };

      mockProfileDao.load.mockResolvedValue(mockProfile);
      mockProfileDao.update.mockResolvedValue(mockProfile);

      await usageQuotaHelper.finalizeProfileComputeUsage(TEST_PROFILE_ITEM.profileId, 8, 10);

      expect(mockProfileDao.update).toHaveBeenCalledWith(
        { profileId: TEST_PROFILE_ITEM.profileId },
        {
          computeMinutesQueued: 12, // 20 - 8
          computeMinutesUsed: 18, // 10 + 8 (since 8 <= 10, use 8)
        },
      );
    });
  });

  describe('finalizeAccountComputeUsage', () => {
    it('should finalize account compute usage when account exists', async () => {
      const mockAccountUsage = {
        ...TEST_ACCOUNT_RESOURCE_USAGE_NORMAL,
        year: 2024,
        month: 3,
        accountComputeMinutesQueued: 100,
        accountComputeMinutesUsed: 50,
      };

      mockAccountResourceUsageDao.get.mockResolvedValue(mockAccountUsage);

      await usageQuotaHelper.finalizeAccountComputeUsage(2024, 3, 20, 15);

      expect(mockAccountResourceUsageDao.update).toHaveBeenCalledWith(
        { year: 2024, month: 3 },
        {
          accountComputeMinutesQueued: 80, // 100 - 20
          accountComputeMinutesUsed: 65, // 50 + 15 (since 20 <= 15 is false, use minutesUsedBySageMaker)
        },
      );
    });

    it('should handle zero queued minutes correctly', async () => {
      const mockAccountUsage = {
        ...TEST_ACCOUNT_RESOURCE_USAGE_EMPTY,
        year: 2024,
        month: 3,
        accountComputeMinutesQueued: 0,
        accountComputeMinutesUsed: 50,
      };

      mockAccountResourceUsageDao.get.mockResolvedValue(mockAccountUsage);
      mockAccountResourceUsageDao.update.mockResolvedValue(mockAccountUsage);

      await usageQuotaHelper.finalizeAccountComputeUsage(2024, 3, 20, 15);

      expect(mockAccountResourceUsageDao.update).toHaveBeenCalledWith(
        { year: 2024, month: 3 },
        {
          accountComputeMinutesQueued: 0, // stays 0
          accountComputeMinutesUsed: 65, // 50 + 15 (since 20 <= 15 is false, use minutesUsedBySageMaker)
        },
      );
    });

    it('should not update when account does not exist', async () => {
      mockAccountResourceUsageDao.get.mockResolvedValue(null);

      await usageQuotaHelper.finalizeAccountComputeUsage(2024, 3, 20, 15);

      expect(mockAccountResourceUsageDao.update).not.toHaveBeenCalled();
    });
  });

  describe('resetMonthlyQuotas', () => {
    it('should reset quotas for single batch of profiles', async () => {
      const mockProfiles = [
        { ...TEST_PROFILE_ITEM, profileId: TEST_PROFILE_ITEM.profileId },
        { ...TEST_PROFILE_ITEM, profileId: TEST_PROFILE_ID_2 },
      ];

      mockProfileDao.list.mockResolvedValueOnce({
        data: mockProfiles,
        cursor: null,
      });
      mockProfileDao.update.mockResolvedValue(TEST_PROFILE_ITEM);

      await usageQuotaHelper.resetMonthlyQuotas(10);

      expect(mockProfileDao.list).toHaveBeenCalledWith({
        maxResults: 10,
        cursor: null,
      });

      expect(mockProfileDao.update).toHaveBeenCalledTimes(2);
      expect(mockProfileDao.update).toHaveBeenCalledWith(
        { profileId: TEST_PROFILE_ITEM.profileId },
        { computeMinutesUsed: 0, modelCount: 0 },
      );
      expect(mockProfileDao.update).toHaveBeenCalledWith(
        { profileId: TEST_PROFILE_ID_2 },
        { computeMinutesUsed: 0, modelCount: 0 },
      );
    });

    it('should handle multiple batches with pagination', async () => {
      const batch1 = [
        { ...TEST_PROFILE_ITEM, profileId: TEST_PROFILE_ITEM.profileId },
        { ...TEST_PROFILE_ITEM, profileId: TEST_PROFILE_ID_2 },
      ];
      const batch2 = [{ ...TEST_PROFILE_ITEM, profileId: TEST_PROFILE_ID_3 }];

      mockProfileDao.list
        .mockResolvedValueOnce({
          data: batch1,
          cursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          data: batch2,
          cursor: null,
        });
      mockProfileDao.update.mockResolvedValue(TEST_PROFILE_ITEM);

      await usageQuotaHelper.resetMonthlyQuotas(2);

      expect(mockProfileDao.list).toHaveBeenCalledTimes(2);
      expect(mockProfileDao.list).toHaveBeenNthCalledWith(1, {
        maxResults: 2,
        cursor: null,
      });
      expect(mockProfileDao.list).toHaveBeenNthCalledWith(2, {
        maxResults: 2,
        cursor: 'cursor1',
      });

      expect(mockProfileDao.update).toHaveBeenCalledTimes(3);
    });

    it('should handle empty batches', async () => {
      mockProfileDao.list.mockResolvedValueOnce({
        data: [],
        cursor: null,
      });

      await usageQuotaHelper.resetMonthlyQuotas();

      expect(mockProfileDao.update).not.toHaveBeenCalled();
    });

    it('should handle update errors gracefully', async () => {
      const mockProfiles = [{ ...TEST_PROFILE_ITEM, profileId: TEST_PROFILE_ITEM.profileId }];

      mockProfileDao.list.mockResolvedValueOnce({
        data: mockProfiles,
        cursor: null,
      });
      mockProfileDao.update.mockRejectedValue(new Error('Update failed'));

      await expect(usageQuotaHelper.resetMonthlyQuotas()).rejects.toThrow('Update failed');
    });
  });

  describe('environment variable configuration', () => {
    let originalEnv: string | undefined;
    let promiseAllSpy: ReturnType<typeof vi.spyOn>;
    let chunkSizes: number[];

    beforeEach(() => {
      originalEnv = process.env.PROFILE_UPDATE_CONCURRENCY;
      promiseAllSpy = vi.spyOn(Promise, 'all');
      chunkSizes = [];

      promiseAllSpy.mockImplementation((promises: unknown) => {
        chunkSizes.push(Array.isArray(promises) ? promises.length : 0);
        return Promise.resolve(Array.isArray(promises) ? promises.map(() => TEST_PROFILE_ITEM) : []);
      });
    });

    afterEach(() => {
      promiseAllSpy.mockRestore();
      if (originalEnv !== undefined) {
        process.env.PROFILE_UPDATE_CONCURRENCY = originalEnv;
      } else {
        delete process.env.PROFILE_UPDATE_CONCURRENCY;
      }
    });

    it('should use PROFILE_UPDATE_CONCURRENCY from environment when defined', async () => {
      process.env.PROFILE_UPDATE_CONCURRENCY = '5';

      // Create 13 profiles to test concurrency chunking (3 chunks: 5, 5, 3)
      const mockProfiles = Array.from({ length: 13 }, () => ({
        ...TEST_PROFILE_ITEM,
        profileId: generateResourceId(),
      }));

      mockProfileDao.list.mockResolvedValueOnce({
        data: mockProfiles,
        cursor: null,
      });
      mockProfileDao.update.mockResolvedValue(TEST_PROFILE_ITEM);

      await usageQuotaHelper.resetMonthlyQuotas(13);

      // Should be called 13 times (once per profile)
      expect(mockProfileDao.update).toHaveBeenCalledTimes(13);

      // Should have 3 chunks with sizes [5, 5, 3]
      expect(chunkSizes).toEqual([5, 5, 3]);
      expect(promiseAllSpy).toHaveBeenCalledTimes(3);
    });

    it('should use default concurrency of 10 when PROFILE_UPDATE_CONCURRENCY is not defined', async () => {
      delete process.env.PROFILE_UPDATE_CONCURRENCY;

      // Create 23 profiles to test default concurrency chunking (3 chunks: 10, 10, 3)
      const mockProfiles = Array.from({ length: 23 }, () => ({
        ...TEST_PROFILE_ITEM,
        profileId: generateResourceId(),
      }));

      mockProfileDao.list.mockResolvedValueOnce({
        data: mockProfiles,
        cursor: null,
      });
      mockProfileDao.update.mockResolvedValue(TEST_PROFILE_ITEM);

      await usageQuotaHelper.resetMonthlyQuotas(23);

      // Should be called 23 times (once per profile)
      expect(mockProfileDao.update).toHaveBeenCalledTimes(23);

      // Should have 3 chunks with sizes [10, 10, 3] (default concurrency is 10)
      expect(chunkSizes).toEqual([10, 10, 3]);
      expect(promiseAllSpy).toHaveBeenCalledTimes(3);
    });
  });
});
