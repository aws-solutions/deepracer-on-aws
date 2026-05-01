// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Leaderboard, Ranking } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import SubmissionVideoModal from '#components/SubmissionVideoModal';

import { useRaceLeaderboardTableConfig } from './RaceLeaderboardTableConfig';

interface RaceLeaderboardTableProps {
  rankings: Ranking[];
  leaderboard: Leaderboard;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const RaceLeaderboardTable = ({ rankings, leaderboard, onRefresh, isRefreshing }: RaceLeaderboardTableProps) => {
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
    selectedVideo,
    setSelectedVideo,
  } = useRaceLeaderboardTableConfig(rankings, leaderboard);

  return (
    <>
      {selectedVideo && (
        <SubmissionVideoModal
          videoUrl={selectedVideo.url}
          title={selectedVideo.title}
          onDismiss={() => setSelectedVideo(null)}
        />
      )}
      <Table
        {...collectionProps}
        items={items}
        columnDefinitions={columnDefinitions}
        columnDisplay={columnDisplay}
        header={
          <Header
            counter={`(${rankings?.length ?? 0})`}
            actions={
              <Button
                iconName="refresh"
                onClick={onRefresh}
                loading={isRefreshing}
                ariaLabel={t('raceLeaderboardTable.refresh')}
              />
            }
          >
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
    </>
  );
};

export default RaceLeaderboardTable;
