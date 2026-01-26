// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Link from '@cloudscape-design/components/link';
import { TableProps } from '@cloudscape-design/components/table';
import { Leaderboard, Submission } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import JobStatusIndicator from '#components/JobStatusIndicator';
import TableEmptyState from '#components/TableEmptyState';
import { PageId } from '#constants/pages.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';
import { getPath } from '#utils/pageUtils.js';

enum SubmissionsTableColumn {
  MODEL_NAME = 'Model name',
  STATUS = 'Status',
  TIME = 'Time',
  DATE = 'Date submitted to race',
}

export const useSubmissionsTableConfig = (submissions: Submission[], leaderboard: Leaderboard) => {
  const { t } = useTranslation('raceDetails');
  const navigate = useNavigate();

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 10, label: t('submissionsTable.collectionPreferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 20, label: t('submissionsTable.collectionPreferences.pageSizeOptionsLabel', { count: 20 }) },
    { value: 30, label: t('submissionsTable.collectionPreferences.pageSizeOptionsLabel', { count: 30 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 10,
    visibleContent: [
      SubmissionsTableColumn.MODEL_NAME,
      SubmissionsTableColumn.STATUS,
      SubmissionsTableColumn.TIME,
      SubmissionsTableColumn.DATE,
    ],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const { items, collectionProps, paginationProps, filteredItemsCount, filterProps } = useCollection(submissions, {
    filtering: {
      empty: (
        <TableEmptyState
          title={t('submissionsTable.emptyTitle')}
          subtitle={t('submissionsTable.emptySubtitle')}
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
          sortingComparator: (item1, item2) => item1.submittedAt.getTime() - item2.submittedAt.getTime(),
        },
        isDescending: true,
      },
    },
    selection: {
      keepSelection: true,
    },
  });

  const columnDefinitions: TableProps.ColumnDefinition<Submission>[] = useMemo(
    () => [
      {
        id: SubmissionsTableColumn.MODEL_NAME,
        header: t('submissionsTable.header.modelName'),
        cell: (e) => (
          <Link
            href="#"
            onFollow={(event) => {
              event.preventDefault();
              navigate(getPath(PageId.MODEL_DETAILS, { modelId: e.modelId }));
            }}
          >
            {e.modelName}
          </Link>
        ),
        sortingField: 'modelName',
      },
      {
        id: SubmissionsTableColumn.TIME,
        header: t('submissionsTable.header.time'),
        cell: (e) => millisToMinutesAndSeconds(e.rankingScore),
        sortingComparator: (item1, item2) => {
          if (!item1.rankingScore) return 1;
          if (!item2.rankingScore) return -1;
          return item1.rankingScore - item2.rankingScore;
        },
      },
      {
        id: SubmissionsTableColumn.STATUS,
        header: t('submissionsTable.header.status'),
        cell: (e) => <JobStatusIndicator status={e.status} />,
        sortingField: 'status',
      },
      {
        id: SubmissionsTableColumn.DATE,
        header: t('submissionsTable.header.date'),
        cell: (e) => e.submittedAt.toLocaleString(),
        sortingComparator: (item1, item2) => item1.submittedAt.getTime() - item2.submittedAt.getTime(),
      },
    ],
    [navigate, t],
  );

  const SubmissionsTablePreferences = () => (
    <CollectionPreferences
      title={t('submissionsTable.collectionPreferences.title')}
      confirmLabel={t('submissionsTable.collectionPreferences.confirmLabel')}
      cancelLabel={t('submissionsTable.collectionPreferences.cancelLabel')}
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: t('submissionsTable.collectionPreferences.pageSizeTitle'),
        options: pageSizeOptions,
      }}
      contentDisplayPreference={{
        title: t('submissionsTable.contentDisplay.title'),
        description: t('submissionsTable.contentDisplay.description'),
        options: [
          {
            id: SubmissionsTableColumn.MODEL_NAME,
            label: t('submissionsTable.header.modelName'),
            alwaysVisible: true,
          },
          {
            id: SubmissionsTableColumn.TIME,
            label: t('submissionsTable.header.time'),
          },
          {
            id: SubmissionsTableColumn.STATUS,
            label: t('submissionsTable.header.status'),
          },
          {
            id: SubmissionsTableColumn.DATE,
            label: t('submissionsTable.header.date'),
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
    SubmissionsTablePreferences,
    filteredItemsCount,
    filterProps,
  };
};
