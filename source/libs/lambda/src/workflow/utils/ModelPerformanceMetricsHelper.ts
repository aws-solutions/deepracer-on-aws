// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EvaluationMetric, SubmissionStats, TimingMethod } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod, s3Helper } from '@deepracer-indy/utils';

import { INVALID_RANKING_SCORE } from '../constants/rankingScore.js';
import type { EvaluationMetricsFile } from '../types/evaluationMetricsFile.js';

class ModelPerformanceMetricsHelper {
  @logMethod
  async getSubmissionStats(metricsS3Location: string, minimumLaps: number) {
    const metrics = await this.getEvaluationMetrics(metricsS3Location);

    const resetCount = metrics.reduce((acc, currentMetric) => acc + currentMetric.resetCount, 0);

    const submissionStats: SubmissionStats = {
      resetCount,
      avgLapTime: this.getBestAverageLapTime(metrics, minimumLaps),
      avgResets: metrics.length ? resetCount / metrics.length : 0,
      bestLapTime: Math.min(...metrics.map((metric) => metric.elapsedTimeInMilliseconds), INVALID_RANKING_SCORE),
      collisionCount: metrics.reduce((acc, currentMetric) => acc + currentMetric.crashCount, 0),
      completedLapCount: this.getMaxConsecutiveCompletedLaps(metrics),
      offTrackCount: metrics.reduce((acc, currentMetric) => acc + currentMetric.offTrackCount, 0),
      totalLapTime: metrics.reduce((acc, currentMetric) => acc + currentMetric.elapsedTimeInMilliseconds, 0),
    };

    return submissionStats;
  }

  @logMethod
  async getEvaluationMetrics(metricsS3Location: string) {
    try {
      const metricsJson = await s3Helper.getObjectAsStringFromS3(metricsS3Location);
      const metricsFile: EvaluationMetricsFile = metricsJson ? JSON.parse(metricsJson) : { metrics: [] };
      const metrics = metricsFile.metrics;

      if (!metrics.length) {
        logger.warn('Evaluation metrics file metrics are empty', { metricsS3Location });
      }

      // Convert to expected format in DDB & API
      return metrics.map(
        (metric): EvaluationMetric => ({
          completionPercentage: metric.completion_percentage,
          crashCount: metric.crash_count,
          elapsedTimeInMilliseconds: metric.elapsed_time_in_milliseconds,
          episodeStatus: metric.episode_status,
          offTrackCount: metric.off_track_count,
          resetCount: metric.reset_count,
          trial: metric.trial,
        }),
      );
    } catch (error) {
      logger.error('Error fetching evaluation metrics', { metricsS3Location, error });
      return [];
    }
  }

  @logMethod
  getRankingScore(submissionStats: SubmissionStats, timingMethod: TimingMethod) {
    switch (timingMethod) {
      case TimingMethod.AVG_LAP_TIME:
        return submissionStats.avgLapTime;
      case TimingMethod.BEST_LAP_TIME:
        return submissionStats.bestLapTime;
      case TimingMethod.TOTAL_TIME:
        return submissionStats.totalLapTime;
      default:
        throw new Error('Invalid timing method');
    }
  }

  getBestAverageLapTime(metrics: EvaluationMetric[], consecutiveLapCount: number) {
    let bestAvgLapTime = INVALID_RANKING_SCORE;

    if (consecutiveLapCount > metrics.length) {
      return bestAvgLapTime;
    }

    outerLoop: for (let i = 0; i <= metrics.length - consecutiveLapCount; i++) {
      let currentWindowLapTimeSum = 0;

      for (let j = i; j < i + consecutiveLapCount; j++) {
        const currentMetric = metrics[j];

        if (currentMetric.completionPercentage === 100) {
          currentWindowLapTimeSum += currentMetric.elapsedTimeInMilliseconds;
        } else {
          continue outerLoop;
        }
      }

      const windowAvgLapTime = Math.floor(currentWindowLapTimeSum / consecutiveLapCount);
      bestAvgLapTime = Math.min(bestAvgLapTime, windowAvgLapTime);
    }

    return bestAvgLapTime;
  }

  getMaxConsecutiveCompletedLaps(metrics: EvaluationMetric[]) {
    let maxConsecutiveCompletedLaps = 0;
    let currentStreak = 0;

    for (const metric of metrics) {
      if (metric.completionPercentage !== 100) {
        currentStreak = 0;
        continue;
      }

      currentStreak += 1;
      maxConsecutiveCompletedLaps = Math.max(maxConsecutiveCompletedLaps, currentStreak);
    }

    return maxConsecutiveCompletedLaps;
  }
}

export const modelPerformanceMetricsHelper = new ModelPerformanceMetricsHelper();
