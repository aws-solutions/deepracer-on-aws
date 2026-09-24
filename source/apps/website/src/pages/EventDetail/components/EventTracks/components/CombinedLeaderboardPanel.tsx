// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Spinner from '@cloudscape-design/components/spinner';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { Ranking } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { useGetCombinedLeaderboardQuery } from '#services/deepRacer/eventsApi.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

export interface CombinedLeaderboardPanelProps {
  eventId: string;
  isActive: boolean;
}

const CombinedLeaderboardPanel = ({ eventId, isActive }: CombinedLeaderboardPanelProps) => {
  const { t } = useTranslation('events');
  const {
    data: combinedLeaderboard,
    isLoading,
    isError,
    refetch,
  } = useGetCombinedLeaderboardQuery({ eventId }, { skip: !eventId || !isActive });

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
        header={t('detail.tracks.combinedLeaderboard.errorTitle')}
        action={<Button onClick={() => refetch()}>{t('detail.statistics.retryButton')}</Button>}
      >
        {t('detail.tracks.combinedLeaderboard.errorMessage')}
      </Alert>
    );
  }

  const rankings = combinedLeaderboard?.rankings ?? [];

  const columnDefinitions: TableProps.ColumnDefinition<Ranking>[] = [
    {
      id: 'rank',
      header: t('detail.tracks.combinedLeaderboard.columnHeaders.rank'),
      cell: (ranking) => ranking.rank,
    },
    {
      id: 'racer',
      header: t('detail.tracks.combinedLeaderboard.columnHeaders.racer'),
      cell: (ranking) => ranking.userProfile.alias,
    },
    {
      id: 'rankingScore',
      header: t('detail.tracks.combinedLeaderboard.columnHeaders.score'),
      cell: (ranking) => millisToMinutesAndSeconds(ranking.rankingScore),
    },
  ];

  return (
    <Table
      items={rankings}
      columnDefinitions={columnDefinitions}
      trackBy="rank"
      empty={
        <Box textAlign="center" color="inherit">
          <Box variant="strong">{t('detail.tracks.combinedLeaderboard.emptyTitle')}</Box>
          <Box variant="p" color="text-body-secondary">
            {t('detail.tracks.combinedLeaderboard.emptySubtitle')}
          </Box>
        </Box>
      }
      header={
        <Header variant="h2" counter={`(${rankings.length})`}>
          {combinedLeaderboard
            ? t('detail.tracks.combinedLeaderboard.header', {
                strategy: t(`combinedScoringStrategy.${combinedLeaderboard.combinedScoringStrategy}`),
              })
            : t('detail.tracks.combinedLeaderboard.headerFallback')}
        </Header>
      }
    />
  );
};

export default CombinedLeaderboardPanel;
