// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SpaceBetween } from '@cloudscape-design/components';
import Box from '@cloudscape-design/components/box';
import Header from '@cloudscape-design/components/header';
import Spinner from '@cloudscape-design/components/spinner';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { Evaluation, EvaluationMetric, JobStatus, RaceType } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { millisToMinutesAndSeconds } from '../../../../../utils/dateTimeUtils.js';
import { TERMINAL_EVALUATION_STATUSES } from '../../../constants.js';

interface EvaluationResultsTableProps {
  evaluation: Evaluation;
}

const EvaluationResultsTable = ({ evaluation }: EvaluationResultsTableProps) => {
  const { t: commonT } = useTranslation('common');
  const { t } = useTranslation('modelDetails', { keyPrefix: 'evaluationDetails.evaluationResultsTable' });

  const columnDefinitions: TableProps.ColumnDefinition<EvaluationMetric>[] = useMemo(
    () => [
      {
        header: t('columnHeaders.trial'),
        cell: (e) => e.trial,
      },
      {
        header: t('columnHeaders.time'),
        cell: (e) => millisToMinutesAndSeconds(e.elapsedTimeInMilliseconds),
      },
      {
        header: t('columnHeaders.trialResult'),
        cell: (e) => `${e.completionPercentage}%`,
      },
      {
        header: t('columnHeaders.status'),
        cell: (e) => e.episodeStatus,
      },
      {
        header: t('columnHeaders.resetCount'),
        cell: (e) => e.resetCount,
      },
      {
        header: t('columnHeaders.offTrackCount'),
        cell: (e) => e.offTrackCount,
      },
      {
        header: t('columnHeaders.offTrackPenalty'),
        cell: (e) =>
          e.offTrackCount
            ? t('seconds', {
                seconds: e.offTrackCount * (evaluation.config.resettingBehaviorConfig.offTrackPenaltySeconds ?? 0),
              })
            : '--',
      },
      ...(evaluation.config.raceType === RaceType.OBJECT_AVOIDANCE
        ? ([
            {
              header: t('columnHeaders.crashCount'),
              cell: (e) => e.crashCount,
            },
            {
              header: t('columnHeaders.crashPenalty'),
              cell: (e) =>
                e.crashCount
                  ? t('seconds', {
                      seconds: e.crashCount * (evaluation.config.resettingBehaviorConfig.collisionPenaltySeconds ?? 0),
                    })
                  : '--',
            },
          ] satisfies TableProps.ColumnDefinition<EvaluationMetric>[])
        : []),
    ],
    [
      evaluation.config.raceType,
      evaluation.config.resettingBehaviorConfig.collisionPenaltySeconds,
      evaluation.config.resettingBehaviorConfig.offTrackPenaltySeconds,
      t,
    ],
  );

  return (
    <Table
      variant="borderless"
      header={<Header variant="h3">{t('header')}</Header>}
      empty={
        <SpaceBetween size="s">
          <Box variant="strong">
            {evaluation.status === JobStatus.COMPLETED && !evaluation.metrics.length
              ? t('empty.noTrialsCompleted')
              : t('empty.noTrials')}
          </Box>
          <Box>{t('empty.status', { status: commonT(`jobStatus.${evaluation.status}`) })}</Box>
          {!TERMINAL_EVALUATION_STATUSES.includes(evaluation.status) && <Spinner />}
        </SpaceBetween>
      }
      items={evaluation.metrics}
      columnDefinitions={columnDefinitions}
    />
  );
};

export default EvaluationResultsTable;
