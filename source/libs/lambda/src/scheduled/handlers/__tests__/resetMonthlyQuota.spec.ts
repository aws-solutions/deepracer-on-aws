// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_MAX_QUERY_RESULTS } from '@deepracer-indy/database';
import type { EventBridgeEvent, Context } from 'aws-lambda';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { usageQuotaHelper } from '../../../utils/UsageQuotaHelper.js';
import { ResetMonthlyQuotas } from '../resetMonthlyQuota.js';

vi.mock('#utils/UsageQuotaHelper.js');
vi.mock('@deepracer-indy/utils', async () => {
  const actual = await vi.importActual('@deepracer-indy/utils');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('ResetMonthlyQuotas', () => {
  const mockUsageQuotaHelper = vi.mocked(usageQuotaHelper);
  mockUsageQuotaHelper.resetMonthlyQuotas.mockResolvedValue();
  const context = {} as Context;

  const event: EventBridgeEvent<'Scheduled Event', Record<string, never>> = {
    version: '0',
    id: 'test-event-id',
    'detail-type': 'Scheduled Event',
    source: 'aws.scheduler',
    account: '123456789012',
    time: '2024-01-01T00:00:00Z',
    region: 'us-east-1',
    resources: ['arn:aws:scheduler:us-east-1:123456789012:schedule/default/monthly-quota-reset'],
    detail: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully reset monthly quotas', async () => {
    mockUsageQuotaHelper.resetMonthlyQuotas.mockResolvedValue();

    const result = await ResetMonthlyQuotas(event, context, vi.fn());

    expect(result).toBeUndefined();
    expect(mockUsageQuotaHelper.resetMonthlyQuotas).toHaveBeenCalledOnce();
  });

  it('should throw error when resetMonthlyQuotas fails', async () => {
    const error = new Error('Unexpected Error');
    mockUsageQuotaHelper.resetMonthlyQuotas.mockRejectedValue(error);

    await expect(ResetMonthlyQuotas(event, context, vi.fn())).rejects.toThrow('Unexpected Error');
    expect(mockUsageQuotaHelper.resetMonthlyQuotas).toHaveBeenCalledOnce();
  });

  it('should use PROFILE_UPDATE_BATCH_SIZE from environment when defined', async () => {
    const originalEnv = process.env.PROFILE_UPDATE_BATCH_SIZE;
    process.env.PROFILE_UPDATE_BATCH_SIZE = '50';

    mockUsageQuotaHelper.resetMonthlyQuotas.mockResolvedValue();

    await ResetMonthlyQuotas(event, context, vi.fn());

    expect(mockUsageQuotaHelper.resetMonthlyQuotas).toHaveBeenCalledWith(50);

    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.PROFILE_UPDATE_BATCH_SIZE = originalEnv;
    } else {
      delete process.env.PROFILE_UPDATE_BATCH_SIZE;
    }
  });

  it('should use DEFAULT_MAX_QUERY_RESULTS when PROFILE_UPDATE_BATCH_SIZE is not defined', async () => {
    const originalEnv = process.env.PROFILE_UPDATE_BATCH_SIZE;
    delete process.env.PROFILE_UPDATE_BATCH_SIZE;

    mockUsageQuotaHelper.resetMonthlyQuotas.mockResolvedValue();

    await ResetMonthlyQuotas(event, context, vi.fn());

    expect(mockUsageQuotaHelper.resetMonthlyQuotas).toHaveBeenCalledWith(DEFAULT_MAX_QUERY_RESULTS);

    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.PROFILE_UPDATE_BATCH_SIZE = originalEnv;
    }
  });
});
