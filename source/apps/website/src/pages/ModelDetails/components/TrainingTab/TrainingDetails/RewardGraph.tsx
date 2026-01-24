// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import LineChart from '@cloudscape-design/components/line-chart';
import { useTranslation } from 'react-i18next';

import { getBestModelPoint, getEvaluationSeries, getTrainingSeries } from './utils';
import type { TrainingMetric } from '../../../../../types/trainingMetrics.js';

interface RewardGraphProps {
  trainingMetrics: TrainingMetric[];
  iterationSize: number;
  isLoading: boolean;
}

const RewardGraph = ({ trainingMetrics, iterationSize, isLoading }: RewardGraphProps) => {
  const { t } = useTranslation('modelDetails', { keyPrefix: 'trainingDetails.rewardGraph' });

  const evaluationPhaseMetrics = trainingMetrics.filter((metric) => metric.phase === 'evaluation');
  const trainingPhaseMetrics = trainingMetrics.filter((metric) => metric.phase === 'training');

  const evaluationSeries = getEvaluationSeries(evaluationPhaseMetrics, iterationSize);
  const trainingSeries = getTrainingSeries(trainingPhaseMetrics, iterationSize);
  const bestModelPoint = getBestModelPoint(evaluationSeries.avgReward, evaluationSeries.avgProgress);

  return (
    <LineChart
      series={[
        ...(trainingSeries.avgReward.length
          ? [
              {
                title: t('series.avgTrainingReward'),
                type: 'line' as const,
                data: trainingSeries.avgReward,
              },
            ]
          : []),
        ...(evaluationSeries.avgReward.length
          ? [
              {
                title: t('series.avgEvaluationReward'),
                type: 'line' as const,
                data: evaluationSeries.avgReward,
              },
            ]
          : []),
        ...(trainingSeries.avgProgress.length
          ? [
              {
                title: t('series.avgTrainingCompletion'),
                type: 'line' as const,
                data: trainingSeries.avgProgress,
                valueFormatter: (v: number) => `${v}%`,
              },
            ]
          : []),
        ...(evaluationSeries.avgProgress.length
          ? [
              {
                title: t('series.avgEvaluationCompletion'),
                type: 'line' as const,
                data: evaluationSeries.avgProgress,
                valueFormatter: (v: number) => `${v}%`,
              },
            ]
          : []),
        ...(bestModelPoint
          ? [
              {
                title: t('series.bestModel'),
                type: 'threshold' as const,
                x: bestModelPoint.x,
              },
            ]
          : []),
      ]}
      emphasizeBaselineAxis
      detailPopoverSize="large"
      height={300}
      statusType={isLoading ? 'loading' : 'finished'}
      loadingText={t('loading')}
      xTitle={t('xTitle')}
      yTitle={t('yTitle')}
      i18nStrings={t('i18nStrings')}
      empty={
        <Box textAlign="center" color="inherit">
          <b>{t('noData.header')}</b>
          <Box variant="p" color="inherit">
            {t('noData.content')}
          </Box>
        </Box>
      }
      noMatch={
        <Box textAlign="center" color="inherit">
          <b>{t('noMatch.header')}</b>
          <Box variant="p" color="inherit">
            {t('noMatch.content')}
          </Box>
        </Box>
      }
    />
  );
};

export default RewardGraph;
