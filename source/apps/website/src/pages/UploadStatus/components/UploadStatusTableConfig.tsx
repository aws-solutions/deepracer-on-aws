// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import { TableProps } from '@cloudscape-design/components/table';
import { DeploymentSummary } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TableEmptyState from '#components/TableEmptyState';

import DeploymentStatusIndicator from './DeploymentStatusIndicator.js';

enum UploadStatusColumn {
  STATUS = 'status',
  MODEL_NAME = 'modelName',
  CAR_NAME = 'carName',
  START_TIME = 'startTime',
  UPLOAD_START_TIME = 'uploadStartTime',
  END_TIME = 'endTime',
  DURATION = 'duration',
  JOB_ID = 'jobId',
}

const durationMs = (d: DeploymentSummary): number | null =>
  d.uploadStartedAt && d.completedAt ? new Date(d.completedAt).getTime() - new Date(d.uploadStartedAt).getTime() : null;

const formatDateTime = (date?: Date): string => {
  if (!date) return '—';
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
};

const PAGE_SIZE_OPTIONS: CollectionPreferencesProps.PageSizeOption[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

const DEFAULT_VISIBLE_COLUMNS = [
  UploadStatusColumn.STATUS,
  UploadStatusColumn.MODEL_NAME,
  UploadStatusColumn.CAR_NAME,
  UploadStatusColumn.START_TIME,
  UploadStatusColumn.UPLOAD_START_TIME,
  UploadStatusColumn.END_TIME,
  UploadStatusColumn.DURATION,
];

export const useUploadStatusTableConfig = (deployments: DeploymentSummary[]) => {
  const { t } = useTranslation('uploadStatus');

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 20,
    contentDisplay: DEFAULT_VISIBLE_COLUMNS.map((id) => ({ id, visible: true })),
    wrapLines: false,
    stripedRows: false,
    contentDensity: 'comfortable',
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const uploadStatusPreferences = useMemo(() => {
    return (
      <CollectionPreferences
        title={t('preferences.title')}
        confirmLabel={t('preferences.confirm')}
        cancelLabel={t('preferences.cancel')}
        preferences={preferences}
        onConfirm={({ detail }) => setPreferences(detail)}
        pageSizePreference={{ title: t('preferences.pageSizeTitle'), options: PAGE_SIZE_OPTIONS }}
        wrapLinesPreference={{ label: t('preferences.wrapLines'), description: t('preferences.wrapLinesDescription') }}
        stripedRowsPreference={{
          label: t('preferences.stripedRows'),
          description: t('preferences.stripedRowsDescription'),
        }}
        contentDensityPreference={{
          label: t('preferences.compactMode'),
          description: t('preferences.compactModeDescription'),
        }}
        contentDisplayPreference={{
          title: t('preferences.visibleColumns'),
          options: [
            { id: UploadStatusColumn.STATUS, label: t('table.columns.status') },
            { id: UploadStatusColumn.MODEL_NAME, label: t('table.columns.modelName'), alwaysVisible: true },
            { id: UploadStatusColumn.CAR_NAME, label: t('table.columns.carName') },
            { id: UploadStatusColumn.START_TIME, label: t('table.columns.startTime') },
            { id: UploadStatusColumn.UPLOAD_START_TIME, label: t('table.columns.uploadStartTime') },
            { id: UploadStatusColumn.END_TIME, label: t('table.columns.endTime') },
            { id: UploadStatusColumn.DURATION, label: t('table.columns.duration') },
            { id: UploadStatusColumn.JOB_ID, label: t('table.columns.jobId') },
          ],
        }}
      />
    );
  }, [t, preferences]);

  const { items, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = useCollection(
    deployments,
    {
      propertyFiltering: {
        filteringProperties: [
          {
            key: 'modelName',
            propertyLabel: t('table.columns.modelName'),
            groupValuesLabel: t('table.columns.modelName'),
            operators: [':', '!:', '=', '!='],
          },
          {
            key: 'carName',
            propertyLabel: t('table.columns.carName'),
            groupValuesLabel: t('table.columns.carName'),
            operators: [':', '!:', '=', '!='],
          },
          {
            key: 'status',
            propertyLabel: t('table.columns.status'),
            groupValuesLabel: t('table.columns.status'),
            operators: ['=', '!='],
          },
        ],
        empty: <TableEmptyState title={t('table.empty.title')} subtitle={t('table.empty.description')} />,
        noMatch: <TableEmptyState title={t('table.noMatch.title')} subtitle={t('table.noMatch.description')} />,
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: {
        defaultState: {
          sortingColumn: { sortingField: 'createdAt' },
          isDescending: true,
        },
      },
    },
  );

  const columnDefinitions: TableProps.ColumnDefinition<DeploymentSummary>[] = useMemo(
    () => [
      {
        id: UploadStatusColumn.STATUS,
        header: t('table.columns.status'),
        cell: (e) => <DeploymentStatusIndicator status={e.status} errorMessage={e.errorMessage} />,
        sortingField: 'status',
        width: 140,
        minWidth: 140,
      },
      {
        id: UploadStatusColumn.MODEL_NAME,
        header: t('table.columns.modelName'),
        cell: (e) => e.modelName ?? e.modelId,
        sortingField: 'modelName',
        width: 200,
        minWidth: 150,
      },
      {
        id: UploadStatusColumn.CAR_NAME,
        header: t('table.columns.carName'),
        cell: (e) => e.carName ?? '—',
        sortingField: 'carName',
        width: 150,
        minWidth: 120,
      },
      {
        id: UploadStatusColumn.START_TIME,
        header: t('table.columns.startTime'),
        cell: (e) => formatDateTime(e.createdAt),
        sortingField: 'createdAt',
        width: 180,
        minWidth: 150,
      },
      {
        id: UploadStatusColumn.UPLOAD_START_TIME,
        header: t('table.columns.uploadStartTime'),
        cell: (e) => formatDateTime(e.uploadStartedAt),
        sortingField: 'uploadStartedAt',
        width: 180,
        minWidth: 150,
      },
      {
        id: UploadStatusColumn.END_TIME,
        header: t('table.columns.endTime'),
        cell: (e) => formatDateTime(e.completedAt),
        sortingField: 'completedAt',
        width: 180,
        minWidth: 150,
      },
      {
        id: UploadStatusColumn.DURATION,
        header: t('table.columns.duration'),
        cell: (e) => {
          const ms = durationMs(e);
          return ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`;
        },
        sortingComparator: (a, b) => (durationMs(a) ?? 0) - (durationMs(b) ?? 0),
        width: 120,
        minWidth: 100,
      },
      {
        id: UploadStatusColumn.JOB_ID,
        header: t('table.columns.jobId'),
        cell: (e) => e.batchId ?? '—',
        sortingField: 'batchId',
        width: 220,
        minWidth: 150,
      },
    ],
    [t],
  );

  return {
    items,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
    columnDefinitions,
    columnDisplay: preferences.contentDisplay,
    preferences,
    uploadStatusPreferences,
  };
};
