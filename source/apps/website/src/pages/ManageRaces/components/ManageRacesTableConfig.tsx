// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Link from '@cloudscape-design/components/link';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { TableProps } from '@cloudscape-design/components/table';
import { Leaderboard, RaceType } from '@deepracer-indy/typescript-client';
import humanizeDuration from 'humanize-duration';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import TableEmptyState from '#components/TableEmptyState';
import { PageId } from '#constants/pages';
import i18n from '#i18n/index.js';
import { getPath } from '#utils/pageUtils';

enum ManageRacesTableColumn {
  NAME = 'Name',
  STATUS = 'Status',
  COMPETITION_FORMAT = 'CompetitionFormat',
  START_DATE = 'StartDate',
  END_DATE = 'EndDate',
}

const getTimeRemaining = (openTime: number, closeTime: number) => {
  // if event is in the past
  if (Date.now() >= closeTime) {
    return <StatusIndicator type="stopped">{i18n.t('leaderboards:table.status.closed')}</StatusIndicator>;
  }
  // if event is ongoing
  if (Date.now() >= openTime && Date.now() < closeTime) {
    return <StatusIndicator type="success">{i18n.t('leaderboards:table.status.open')}</StatusIndicator>;
  }
  return (
    <StatusIndicator type="pending">
      {humanizeDuration(Date.now() - openTime, { units: ['d', 'h', 'm'], largest: 1, round: true })}{' '}
      {i18n.t('leaderboards:table.status.toRace')}
    </StatusIndicator>
  );
};

export const useManageRacesTableConfig = (leaderboards: Leaderboard[]) => {
  const { t } = useTranslation('leaderboards');
  const navigate = useNavigate();

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 10, label: t('table.collectionPreferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 20, label: t('table.collectionPreferences.pageSizeOptionsLabel', { count: 20 }) },
    { value: 30, label: t('table.collectionPreferences.pageSizeOptionsLabel', { count: 30 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 10,
    visibleContent: [
      ManageRacesTableColumn.NAME,
      ManageRacesTableColumn.STATUS,
      ManageRacesTableColumn.COMPETITION_FORMAT,
      ManageRacesTableColumn.START_DATE,
      ManageRacesTableColumn.END_DATE,
    ],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const { items, collectionProps, paginationProps, filteredItemsCount, filterProps } = useCollection(leaderboards, {
    filtering: {
      empty: (
        <TableEmptyState
          title={t('table.emptyTitle')}
          subtitle={t('table.emptySubtitle')}
          action={<Button onClick={() => navigate(getPath(PageId.CREATE_RACE))}>{t('table.createRaceButton')}</Button>}
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingComparator: (item1, item2) => item1.openTime.getTime() - item2.openTime.getTime(),
        },
        isDescending: true,
      },
    },
    selection: {
      keepSelection: true,
    },
  });

  const columnDefinitions: TableProps.ColumnDefinition<Leaderboard>[] = useMemo(
    () => [
      {
        id: ManageRacesTableColumn.NAME,
        header: t('table.columnHeader.name'),
        cell: (e) => (
          <Link
            href="#"
            onFollow={(event) => {
              event.preventDefault();
              navigate(getPath(PageId.RACE_DETAILS, { leaderboardId: e.leaderboardId }));
            }}
          >
            {e.name}
          </Link>
        ),
        sortingField: 'name',
      },
      {
        id: ManageRacesTableColumn.STATUS,
        header: t('table.columnHeader.status'),
        cell: (e) => getTimeRemaining(e.openTime.getTime(), e.closeTime.getTime()),
        sortingComparator: (item1, item2) => item1.openTime.getTime() - item2.openTime.getTime(),
      },
      /* TODO: fix the race type to be classic/live */
      {
        id: ManageRacesTableColumn.COMPETITION_FORMAT,
        header: t('table.columnHeader.competitionFormat'),
        cell: (e) =>
          e.raceType === RaceType.TIME_TRIAL ? t('table.raceType.timeTrial') : t('table.raceType.objectAvoidance'),
        sortingField: 'raceType',
      },
      {
        id: ManageRacesTableColumn.START_DATE,
        header: t('table.columnHeader.startDate'),
        cell: (e) => t('table.creationTime', { date: e.openTime }),
        sortingComparator: (item1, item2) => item1.openTime.getTime() - item2.openTime.getTime(),
      },
      {
        id: ManageRacesTableColumn.END_DATE,
        header: t('table.columnHeader.endDate'),
        cell: (e) => t('table.creationTime', { date: e.closeTime }),
        sortingComparator: (item1, item2) => item1.closeTime.getTime() - item2.closeTime.getTime(),
      },
    ],
    [navigate, t],
  );

  const ManageRacesTablePreferences = () => (
    <CollectionPreferences
      title={t('table.collectionPreferences.title')}
      confirmLabel={t('table.collectionPreferences.confirmLabel')}
      cancelLabel={t('table.collectionPreferences.cancelLabel')}
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: t('table.collectionPreferences.pageSizeTitle'),
        options: pageSizeOptions,
      }}
      contentDisplayPreference={{
        title: t('table.contentDisplay.title'),
        description: t('table.contentDisplay.description'),
        options: [
          {
            id: ManageRacesTableColumn.NAME,
            label: t('table.columnHeader.name'),
            alwaysVisible: true,
          },
          {
            id: ManageRacesTableColumn.STATUS,
            label: t('table.columnHeader.status'),
          },
          {
            id: ManageRacesTableColumn.COMPETITION_FORMAT,
            label: t('table.columnHeader.competitionFormat'),
          },
          {
            id: ManageRacesTableColumn.START_DATE,
            label: t('table.columnHeader.startDate'),
          },
          {
            id: ManageRacesTableColumn.END_DATE,
            label: t('table.columnHeader.endDate'),
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
    ManageRacesTablePreferences,
    filteredItemsCount,
    filterProps,
  };
};
