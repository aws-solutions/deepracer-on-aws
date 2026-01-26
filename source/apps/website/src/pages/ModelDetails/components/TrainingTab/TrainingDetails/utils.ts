// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { MixedLineBarChartProps } from '@cloudscape-design/components/mixed-line-bar-chart';

import type { TrainingMetric } from '#types/trainingMetrics.js';

export const getEvaluationSeries = (evaluationPhaseMetrics: TrainingMetric[], iterationSize: number) => {
  const evaluationResultsByEpisode = evaluationPhaseMetrics.reduce(
    (acc, currentMetric) => {
      if (!acc[currentMetric.episode]) {
        acc[currentMetric.episode] = {
          episodeCount: 1,
          episode: currentMetric.episode,
          completionPercentage: currentMetric.completion_percentage,
          rewardScore: currentMetric.reward_score,
        };
        return acc;
      }

      acc[currentMetric.episode].episodeCount += 1;
      acc[currentMetric.episode].completionPercentage += currentMetric.completion_percentage;
      acc[currentMetric.episode].rewardScore += currentMetric.reward_score;

      return acc;
    },
    {} as Record<number, { completionPercentage: number; rewardScore: number; episode: number; episodeCount: number }>,
  );

  const avgProgress: MixedLineBarChartProps.Datum<number>[] = [];
  const avgReward: MixedLineBarChartProps.Datum<number>[] = [];

  Object.values(evaluationResultsByEpisode).forEach((evaluationResult) => {
    avgProgress.push({
      x: evaluationResult.episode / iterationSize,
      y: evaluationResult.completionPercentage / evaluationResult.episodeCount,
    });
    avgReward.push({
      x: evaluationResult.episode / iterationSize,
      y: evaluationResult.rewardScore / evaluationResult.episodeCount,
    });
  });

  return { avgProgress, avgReward };
};

export const getTrainingSeries = (trainingPhaseMetrics: TrainingMetric[], iterationSize: number) => {
  const avgReward: MixedLineBarChartProps.Datum<number>[] = [];
  const avgProgress: MixedLineBarChartProps.Datum<number>[] = [];

  for (let i = 0; i < trainingPhaseMetrics.length; i += iterationSize) {
    const batch = trainingPhaseMetrics.slice(i, i + iterationSize);
    const iteration = (i + iterationSize) / iterationSize;

    if (batch.length > 0) {
      const batchAvgReward = batch.reduce((sum, m) => sum + m.reward_score, 0) / batch.length;
      const batchAvgProgress = batch.reduce((sum, m) => sum + m.completion_percentage, 0) / batch.length;

      avgReward.push({ x: iteration, y: batchAvgReward });
      avgProgress.push({ x: iteration, y: batchAvgProgress });
    }
  }

  return { avgProgress, avgReward };
};

export const getBestModelPoint = (
  avgEvalRewardData: MixedLineBarChartProps.Datum<number>[],
  avgEvalProgressData: MixedLineBarChartProps.Datum<number>[],
) => {
  if (avgEvalRewardData.length > 0) {
    return avgEvalRewardData.reduce((prev, current) => (prev.y > current.y ? prev : current));
  }
  if (avgEvalProgressData.length > 0) {
    return avgEvalProgressData.reduce((prev, current) => (prev.y > current.y ? prev : current));
  }

  return null;
};
