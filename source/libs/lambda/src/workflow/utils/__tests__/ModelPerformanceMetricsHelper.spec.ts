// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_EVALUATION_ITEM } from '@deepracer-indy/database';
import {
  EpisodeStatus,
  EvaluationMetric,
  SubmissionStats,
  TimingMethod,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { INVALID_RANKING_SCORE } from '../../constants/rankingScore.js';
import { TEST_EVALUATION_METRICS_FILE } from '../../constants/testConstants.js';
import { modelPerformanceMetricsHelper } from '../ModelPerformanceMetricsHelper.js';

describe('ModelPerformanceMetricsHelper', () => {
  describe('getEvaluationMetrics()', () => {
    it('should return evaluation metrics', async () => {
      const getObjectAsStringFromS3Spy = vi
        .spyOn(s3Helper, 'getObjectAsStringFromS3')
        .mockResolvedValueOnce(JSON.stringify(TEST_EVALUATION_METRICS_FILE));

      await expect(
        modelPerformanceMetricsHelper.getEvaluationMetrics(TEST_EVALUATION_ITEM.assetS3Locations.metricsS3Location),
      ).resolves.toEqual(
        TEST_EVALUATION_METRICS_FILE.metrics.map((metric) => ({
          completionPercentage: metric.completion_percentage,
          crashCount: metric.crash_count,
          elapsedTimeInMilliseconds: metric.elapsed_time_in_milliseconds,
          episodeStatus: metric.episode_status,
          offTrackCount: metric.off_track_count,
          resetCount: metric.reset_count,
          trial: metric.trial,
        })),
      );

      expect(getObjectAsStringFromS3Spy).toHaveBeenCalledWith(TEST_EVALUATION_ITEM.assetS3Locations.metricsS3Location);
    });

    it('should return an empty list if fetching metrics fails', async () => {
      const getObjectAsStringFromS3Spy = vi
        .spyOn(s3Helper, 'getObjectAsStringFromS3')
        .mockRejectedValueOnce(new Error('Failed to fetch metrics'));

      await expect(
        modelPerformanceMetricsHelper.getEvaluationMetrics(TEST_EVALUATION_ITEM.assetS3Locations.metricsS3Location),
      ).resolves.toEqual([]);

      expect(getObjectAsStringFromS3Spy).toHaveBeenCalledWith(TEST_EVALUATION_ITEM.assetS3Locations.metricsS3Location);
    });
  });

  describe('getSubmissionStats()', () => {
    it('should return submission stats', async () => {
      const mockMetrics: EvaluationMetric[] = [
        {
          completionPercentage: 100,
          elapsedTimeInMilliseconds: 10000,
          crashCount: 0,
          episodeStatus: EpisodeStatus.LAP_COMPLETE,
          offTrackCount: 1,
          resetCount: 1,
          trial: 1,
        },
        {
          completionPercentage: 100,
          elapsedTimeInMilliseconds: 12000,
          crashCount: 0,
          episodeStatus: EpisodeStatus.LAP_COMPLETE,
          offTrackCount: 0,
          resetCount: 0,
          trial: 2,
        },
        {
          completionPercentage: 100,
          elapsedTimeInMilliseconds: 11000,
          crashCount: 0,
          episodeStatus: EpisodeStatus.LAP_COMPLETE,
          offTrackCount: 0,
          resetCount: 0,
          trial: 3,
        },
        {
          completionPercentage: 100,
          elapsedTimeInMilliseconds: 9000,
          crashCount: 0,
          episodeStatus: EpisodeStatus.LAP_COMPLETE,
          offTrackCount: 0,
          resetCount: 0,
          trial: 4,
        },
      ];
      vi.spyOn(modelPerformanceMetricsHelper, 'getEvaluationMetrics').mockResolvedValueOnce(mockMetrics);

      await expect(modelPerformanceMetricsHelper.getSubmissionStats('mockMetricsS3Location', 2)).resolves.toEqual({
        avgLapTime: 10000,
        bestLapTime: 9000,
        avgResets: 0.25,
        collisionCount: 0,
        completedLapCount: 4,
        offTrackCount: 1,
        resetCount: 1,
        totalLapTime: 42000,
      });
    });
  });

  describe('getRankingScore()', () => {
    it('should return correct ranking score', () => {
      const mockSubmissionStats: SubmissionStats = {
        avgLapTime: 2000,
        bestLapTime: 2000,
        avgResets: 0,
        collisionCount: 0,
        completedLapCount: 5,
        offTrackCount: 0,
        resetCount: 0,
        totalLapTime: 10000,
      };

      expect(modelPerformanceMetricsHelper.getRankingScore(mockSubmissionStats, TimingMethod.AVG_LAP_TIME)).toEqual(
        mockSubmissionStats.avgLapTime,
      );
      expect(modelPerformanceMetricsHelper.getRankingScore(mockSubmissionStats, TimingMethod.BEST_LAP_TIME)).toEqual(
        mockSubmissionStats.bestLapTime,
      );
      expect(modelPerformanceMetricsHelper.getRankingScore(mockSubmissionStats, TimingMethod.TOTAL_TIME)).toEqual(
        mockSubmissionStats.totalLapTime,
      );
    });
  });

  describe('getBestAverageLapTime', () => {
    it('should calculate the best average lap time for consecutive completed laps', () => {
      const mockMetrics = [
        { completionPercentage: 100, elapsedTimeInMilliseconds: 10000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 12000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 11000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 9000 },
      ] as EvaluationMetric[];

      expect(modelPerformanceMetricsHelper.getBestAverageLapTime(mockMetrics, 2)).toBe(10000); // (11000 + 9000) / 2
    });

    it('should skip incomplete laps', () => {
      const mockMetrics = [
        { completionPercentage: 100, elapsedTimeInMilliseconds: 10000 },
        { completionPercentage: 80, elapsedTimeInMilliseconds: 8000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 11000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 9000 },
      ] as EvaluationMetric[];

      expect(modelPerformanceMetricsHelper.getBestAverageLapTime(mockMetrics, 2)).toBe(10000); // (11000 + 9000) / 2
    });

    it('should return INVALID_RANKING_SCORE when consecutiveLapCount is greater than metrics length', () => {
      const mockMetrics = [
        { completionPercentage: 100, elapsedTimeInMilliseconds: 10000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 12000 },
      ] as EvaluationMetric[];

      expect(modelPerformanceMetricsHelper.getBestAverageLapTime(mockMetrics, 3)).toBe(INVALID_RANKING_SCORE);
    });

    it('should return INVALID_RANKING_SCORE when not enough consecutive completed laps are found', () => {
      const mockMetrics = [
        { completionPercentage: 100, elapsedTimeInMilliseconds: 10000 },
        { completionPercentage: 80, elapsedTimeInMilliseconds: 8000 },
        { completionPercentage: 90, elapsedTimeInMilliseconds: 11000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 9000 },
        { completionPercentage: 100, elapsedTimeInMilliseconds: 9000 },
      ] as EvaluationMetric[];

      expect(modelPerformanceMetricsHelper.getBestAverageLapTime(mockMetrics, 3)).toBe(INVALID_RANKING_SCORE);
    });

    it('should handle an empty metrics array', () => {
      expect(modelPerformanceMetricsHelper.getBestAverageLapTime([], 1)).toBe(INVALID_RANKING_SCORE);
    });
  });
});
