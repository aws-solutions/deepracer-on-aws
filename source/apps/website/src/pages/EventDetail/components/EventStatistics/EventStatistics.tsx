// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Spinner from '@cloudscape-design/components/spinner';
import { useTranslation } from 'react-i18next';

import { useGetEventStatisticsQuery } from '#services/deepRacer/eventsApi.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

interface EventStatisticsProps {
  eventId: string;
  isActive: boolean;
}

interface MetricCardProps {
  label: string;
  value: string;
}

const MetricCard = ({ label, value }: MetricCardProps) => (
  <div>
    <Box variant="awsui-key-label">{label}</Box>
    <Box variant="awsui-value-large" tagOverride="h3" margin="n">
      {value}
    </Box>
  </div>
);

const EventStatistics = ({ eventId, isActive }: EventStatisticsProps) => {
  const { t } = useTranslation('events');
  const {
    data: statistics,
    isLoading,
    isError,
    refetch,
  } = useGetEventStatisticsQuery({ eventId }, { skip: !eventId || !isActive });

  if (!isActive) {
    return null;
  }

  if (isLoading) {
    return (
      <Container>
        <Box textAlign="center" padding="xl">
          <Spinner />
        </Box>
      </Container>
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        header={t('detail.statistics.errorTitle')}
        action={<Button onClick={() => refetch()}>{t('detail.statistics.retryButton')}</Button>}
      >
        {t('detail.statistics.errorMessage')}
      </Alert>
    );
  }

  if (!statistics || statistics.totalRuns === 0) {
    return (
      <Container>
        <Box textAlign="center" padding="xl">
          <Box variant="strong">{t('detail.statistics.emptyTitle')}</Box>
          <Box color="text-body-secondary">{t('detail.statistics.emptySubtitle')}</Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container header={<Header variant="h2">{t('detail.statistics.header')}</Header>}>
      <ColumnLayout columns={3} variant="text-grid">
        <MetricCard label={t('detail.statistics.metrics.totalRuns')} value={String(statistics.totalRuns)} />
        <MetricCard label={t('detail.statistics.metrics.completedRuns')} value={String(statistics.completedRuns)} />
        <MetricCard label={t('detail.statistics.metrics.discardedRuns')} value={String(statistics.discardedRuns)} />
        <MetricCard
          label={t('detail.statistics.metrics.uniqueRacerCount')}
          value={String(statistics.uniqueRacerCount)}
        />
        <MetricCard label={t('detail.statistics.metrics.totalValidLaps')} value={String(statistics.totalValidLaps)} />
        <MetricCard
          label={t('detail.statistics.metrics.averageLapsPerRun')}
          value={statistics.averageLapsPerRun.toFixed(1)}
        />
        <MetricCard
          label={t('detail.statistics.metrics.fastestLapMs')}
          value={millisToMinutesAndSeconds(statistics.fastestLapMs)}
        />
        <MetricCard
          label={t('detail.statistics.metrics.averageLapTimeMs')}
          value={millisToMinutesAndSeconds(statistics.averageLapTimeMs)}
        />
        <MetricCard
          label={t('detail.statistics.metrics.completionRate')}
          value={`${Math.round(statistics.completionRate * 100)}%`}
        />
      </ColumnLayout>
    </Container>
  );
};

export default EventStatistics;
