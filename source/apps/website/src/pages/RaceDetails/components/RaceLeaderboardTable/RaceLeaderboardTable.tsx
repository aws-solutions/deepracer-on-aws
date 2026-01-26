// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Leaderboard, Ranking } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { useRaceLeaderboardTableConfig } from './RaceLeaderboardTableConfig';

interface RaceLeaderboardTableProps {
  rankings: Ranking[];
  leaderboard: Leaderboard;
}

const RaceLeaderboardTable = ({ rankings, leaderboard }: RaceLeaderboardTableProps) => {
  const { t } = useTranslation('raceDetails');

  const {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    items,
    RaceLeaderboardTablePreferences,
    paginationProps,
    filterProps,
    filteredItemsCount,
  } = useRaceLeaderboardTableConfig(rankings, leaderboard);

  return (
    <Table
      {...collectionProps}
      items={items}
      columnDefinitions={columnDefinitions}
      columnDisplay={columnDisplay}
      header={
        <Header counter={`(${rankings?.length ?? 0})`}>
          {t('raceLeaderboardTable.header.name', { name: leaderboard.name })}
        </Header>
      }
      trackBy="rank"
      pagination={
        <Pagination
          {...paginationProps}
          ariaLabels={{
            nextPageLabel: t('raceLeaderboardTable.pagination.nextPageLabel'),
            previousPageLabel: t('raceLeaderboardTable.pagination.previousPageLabel'),
            pageLabel: (pageNumber: number) => t('raceLeaderboardTable.pagination.pageLabel', { pageNumber }),
          }}
        />
      }
      preferences={<RaceLeaderboardTablePreferences />}
      filter={
        <TextFilter
          {...filterProps}
          filteringAriaLabel={t('raceLeaderboardTable.filters.filteringAriaLabel')}
          filteringPlaceholder={t('raceLeaderboardTable.filters.searchFilterPlaceholder')}
          countText={
            filterProps.filteringText &&
            t('raceLeaderboardTable.filters.matchCount', { count: filteredItemsCount ?? 0 })
          }
        />
      }
    />
  );
};

export default RaceLeaderboardTable;
