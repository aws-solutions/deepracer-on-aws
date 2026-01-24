// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';

import {
  TEST_ACCOUNT_RESOURCE_USAGE_NORMAL,
  TEST_ACCOUNT_RESOURCE_USAGE_EMPTY,
} from '../../constants/testConstants.js';
import { AccountResourceUsageEntity } from '../../entities/AccountResourceUsageEntity.js';
import { accountResourceUsageDao } from '../AccountResourceUsageDao.js';

vi.mock('#entities/AccountResourceUsageEntity.js', () => ({
  AccountResourceUsageEntity: {
    get: vi.fn(),
    create: vi.fn(),
  },
}));

describe('AccountResourceUsageDao', () => {
  describe('getOrCreate()', () => {
    it('should return account resource usage', async () => {
      vi.mocked(AccountResourceUsageEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: TEST_ACCOUNT_RESOURCE_USAGE_NORMAL }),
        params: vi.fn(),
      });

      const result = await accountResourceUsageDao.getOrCreate(new Date().getFullYear(), new Date().getMonth() + 1);

      expect(result).toEqual(TEST_ACCOUNT_RESOURCE_USAGE_NORMAL);
    });

    it('should return empty record if account resource usage does not exist', async () => {
      vi.mocked(AccountResourceUsageEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
        params: vi.fn(),
      });
      vi.mocked(AccountResourceUsageEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: TEST_ACCOUNT_RESOURCE_USAGE_EMPTY }),
        params: vi.fn(),
        where: vi.fn(),
      });

      const result = await accountResourceUsageDao.getOrCreate(new Date().getFullYear(), new Date().getMonth() + 1);

      expect(result).toEqual(TEST_ACCOUNT_RESOURCE_USAGE_EMPTY);
    });
  });
});
