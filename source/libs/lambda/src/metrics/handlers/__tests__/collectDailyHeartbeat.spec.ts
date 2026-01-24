// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { metricsDao } from '@deepracer-indy/database';
import { metricsLogger } from '@deepracer-indy/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectDailyHeartbeat } from '../collectDailyHeartbeat.js';

vi.mock('@deepracer-indy/database', () => ({
  metricsDao: {
    collectSystemMetrics: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', async () => {
  const original = await vi.importActual('@deepracer-indy/utils');
  return {
    ...original,
    metricsLogger: {
      logHeartbeat: vi.fn(),
    },
  };
});

vi.mock('#utils/instrumentation/instrumentHandler.js', () => ({
  instrumentHandler: vi.fn((handler) => handler),
}));

describe('collectDailyHeartbeat', () => {
  const mockSystemMetrics = {
    modelCount: 25,
    profileCount: 10,
    leaderboardCount: 5,
    trainingJobCount: 15,
    evaluationJobCount: 8,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('CollectDailyHeartbeat', () => {
    it('should collect system metrics and log heartbeat successfully', async () => {
      vi.mocked(metricsDao.collectSystemMetrics).mockResolvedValue(mockSystemMetrics);

      await CollectDailyHeartbeat({} as never, {} as never, {} as never);

      expect(metricsDao.collectSystemMetrics).toHaveBeenCalledTimes(1);
      expect(metricsLogger.logHeartbeat).toHaveBeenCalledTimes(1);
      expect(metricsLogger.logHeartbeat).toHaveBeenCalledWith({
        models: mockSystemMetrics.modelCount,
        users: mockSystemMetrics.profileCount,
        races: mockSystemMetrics.leaderboardCount,
        trainingJobs: mockSystemMetrics.trainingJobCount,
        evaluationJobs: mockSystemMetrics.evaluationJobCount,
      });
    });

    it('should log error and rethrow when collectSystemMetrics fails', async () => {
      const error = new Error('Database connection failed');
      vi.mocked(metricsDao.collectSystemMetrics).mockRejectedValue(error);

      await expect(CollectDailyHeartbeat({} as never, {} as never, {} as never)).rejects.toThrow(
        'Database connection failed',
      );

      expect(metricsDao.collectSystemMetrics).toHaveBeenCalledTimes(1);
      expect(metricsLogger.logHeartbeat).not.toHaveBeenCalled();
    });

    it('should log error and rethrow when metricsLogger.logHeartbeat fails', async () => {
      vi.mocked(metricsDao.collectSystemMetrics).mockResolvedValue(mockSystemMetrics);
      const error = new Error('Logging failed');
      vi.mocked(metricsLogger.logHeartbeat).mockImplementation(() => {
        throw error;
      });

      await expect(CollectDailyHeartbeat({} as never, {} as never, {} as never)).rejects.toThrow('Logging failed');

      expect(metricsDao.collectSystemMetrics).toHaveBeenCalledTimes(1);
      expect(metricsLogger.logHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected error types', async () => {
      const error = 'String error';
      vi.mocked(metricsDao.collectSystemMetrics).mockRejectedValue(error);

      await expect(CollectDailyHeartbeat({} as never, {} as never, {} as never)).rejects.toBe('String error');
    });
  });
});
