// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import { TableProps } from '@cloudscape-design/components/table';
import { Ranking, Leaderboard } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import TableEmptyState from '#components/TableEmptyState/TableEmptyState.js';
import { PageId } from '#constants/pages.js';
import { getRacingTimeGap, millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';
import { getPath } from '#utils/pageUtils.js';

enum RaceLeaderboardTableColumn {
  RANK = 'Rank',
  RACER = 'Racer',
  TIME = 'Time',
  GAP_TO_FIRST = 'Gap to 1st',
  VIDEO = 'Video',
  OFF_TRACK = 'Off-track',
}

export const useRaceLeaderboardTableConfig = (rankings: Ranking[], leaderboard: Leaderboard) => {
  const { t } = useTranslation('raceDetails');
  const navigate = useNavigate();

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 10, label: t('raceLeaderboardTable.collectionPreferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 20, label: t('raceLeaderboardTable.collectionPreferences.pageSizeOptionsLabel', { count: 20 }) },
    { value: 30, label: t('raceLeaderboardTable.collectionPreferences.pageSizeOptionsLabel', { count: 30 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 10,
    visibleContent: [
      RaceLeaderboardTableColumn.RANK,
      RaceLeaderboardTableColumn.RACER,
      RaceLeaderboardTableColumn.TIME,
      RaceLeaderboardTableColumn.GAP_TO_FIRST,
      RaceLeaderboardTableColumn.OFF_TRACK,
    ],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const { items, collectionProps, paginationProps, filteredItemsCount, filterProps } = useCollection(rankings, {
    filtering: {
      empty: (
        <TableEmptyState
          title={t('raceLeaderboardTable.emptyTitle')}
          subtitle={t('raceLeaderboardTable.emptySubtitle')}
          action={
            <Button
              onClick={() => navigate(getPath(PageId.ENTER_RACE, { leaderboardId: leaderboard.leaderboardId }))}
              disabled={leaderboard.openTime > new Date() || leaderboard.closeTime <= new Date()}
            >
              {t('enterRace')}
            </Button>
          }
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: 'rank',
        },
        isDescending: false,
      },
    },
    selection: {
      keepSelection: true,
    },
  });

  const columnDefinitions: TableProps.ColumnDefinition<Ranking>[] = useMemo(
    () => [
      {
        id: RaceLeaderboardTableColumn.RANK,
        header: t('raceLeaderboardTable.header.rank'),
        cell: (e) => e.rank,
        sortingField: 'rank',
      },
      {
        id: RaceLeaderboardTableColumn.RACER,
        header: t('raceLeaderboardTable.header.racer'),
        cell: (e) => e.userProfile.alias,
        sortingComparator: (item1, item2) => item1.userProfile.alias.localeCompare(item2.userProfile.alias),
      },
      {
        id: RaceLeaderboardTableColumn.TIME,
        header: t('raceLeaderboardTable.header.time'),
        cell: (e) => millisToMinutesAndSeconds(e.rankingScore),
        sortingField: 'rankingScore',
      },
      {
        id: RaceLeaderboardTableColumn.GAP_TO_FIRST,
        header: t('raceLeaderboardTable.header.gapToFirst'),
        cell: (e) => getRacingTimeGap(rankings[0].rankingScore, e.rankingScore),
        sortingField: 'rankingScore',
      },
      {
        id: RaceLeaderboardTableColumn.OFF_TRACK,
        header: t('raceLeaderboardTable.header.offtrack'),
        cell: (e) => e.stats.offTrackCount,
        sortingComparator: (item1, item2) => item1.stats.offTrackCount - item2.stats.offTrackCount,
      },
    ],
    [rankings, t],
  );

  const RaceLeaderboardTablePreferences = () => (
    <CollectionPreferences
      title={t('raceLeaderboardTable.collectionPreferences.title')}
      confirmLabel={t('raceLeaderboardTable.collectionPreferences.confirmLabel')}
      cancelLabel={t('raceLeaderboardTable.collectionPreferences.cancelLabel')}
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: t('raceLeaderboardTable.collectionPreferences.pageSizeTitle'),
        options: pageSizeOptions,
      }}
      contentDisplayPreference={{
        title: t('raceLeaderboardTable.contentDisplay.title'),
        description: t('raceLeaderboardTable.contentDisplay.description'),
        options: [
          {
            id: RaceLeaderboardTableColumn.RANK,
            label: t('raceLeaderboardTable.header.rank'),
            alwaysVisible: true,
          },
          {
            id: RaceLeaderboardTableColumn.RACER,
            label: t('raceLeaderboardTable.header.racer'),
          },
          {
            id: RaceLeaderboardTableColumn.TIME,
            label: t('raceLeaderboardTable.header.time'),
          },
          {
            id: RaceLeaderboardTableColumn.GAP_TO_FIRST,
            label: t('raceLeaderboardTable.header.gapToFirst'),
          },
          {
            id: RaceLeaderboardTableColumn.OFF_TRACK,
            label: t('raceLeaderboardTable.header.offtrack'),
          },
        ],
      }}
    />
  );

  return {
    collectionProps,
    columnDefinitions,
    columnDisplay: preferences.contentDisplay,
    items,
    paginationProps,
    selectedItems: collectionProps.selectedItems,
    RaceLeaderboardTablePreferences,
    filteredItemsCount,
    filterProps,
  };
};
