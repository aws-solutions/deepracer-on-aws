// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import PropertyFilter, { type PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { CarLogFetchJob } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPropertyFilterI18nStrings } from '#components/PropertyFilterI18nStrings/index.js';
import TableEmptyState from '#components/TableEmptyState';

import CarLogStatusIndicator from './CarLogStatusIndicator.js';
import { formatCarLogDateTime } from '../utils.js';

enum ProcessingColumn {
  STATUS = 'status',
  DEVICE = 'device',
  EVENT = 'event',
  STARTED = 'started',
  ENDED = 'ended',
  ERROR = 'error',
}

interface CarLogProcessingTableItem extends CarLogFetchJob {
  deviceLabel: string;
  eventLabel: string;
  startedAtText: string;
  endedAtText: string;
  errorText: string;
}

interface CarLogProcessingTableProps {
  isFetching: boolean;
  isLoading: boolean;
  jobs: CarLogFetchJob[];
  onRefresh: () => void;
}

const PAGE_SIZE_OPTIONS: CollectionPreferencesProps.PageSizeOption[] = [10, 25, 50].map((value) => ({
  value,
  label: value.toString(),
}));

const DEFAULT_CONTENT_DISPLAY: CollectionPreferencesProps.ContentDisplayItem[] = [
  { id: ProcessingColumn.STATUS, visible: true },
  { id: ProcessingColumn.DEVICE, visible: true },
  { id: ProcessingColumn.EVENT, visible: true },
  { id: ProcessingColumn.STARTED, visible: true },
  { id: ProcessingColumn.ENDED, visible: true },
  { id: ProcessingColumn.ERROR, visible: true },
];

const CarLogProcessingTable = ({ isFetching, isLoading, jobs, onRefresh }: CarLogProcessingTableProps) => {
  const { t } = useTranslation('carLogs');
  const { t: tCommon } = useTranslation('common');
  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: 10,
    contentDisplay: DEFAULT_CONTENT_DISPLAY,
    stripedRows: false,
    contentDensity: 'comfortable',
    wrapLines: false,
  });

  const items = useMemo<CarLogProcessingTableItem[]>(
    () =>
      jobs.map((job) => ({
        ...job,
        deviceLabel: job.carName ?? job.instanceId ?? '—',
        eventLabel: job.eventName ?? job.eventId ?? '—',
        startedAtText: formatCarLogDateTime(job.createdAt),
        endedAtText: formatCarLogDateTime(job.endedAt),
        errorText: job.errorMessage ?? '—',
      })),
    [jobs],
  );

  const filteringProperties = useMemo<PropertyFilterProps.FilteringProperty[]>(
    () => [
      {
        key: 'status',
        propertyLabel: t('processing.columns.status'),
        groupValuesLabel: t('processing.columns.status'),
        operators: ['=', '!='],
      },
      {
        key: 'deviceLabel',
        propertyLabel: t('processing.columns.device'),
        groupValuesLabel: t('processing.columns.device'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'eventLabel',
        propertyLabel: t('processing.columns.event'),
        groupValuesLabel: t('processing.columns.event'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'startedAtText',
        propertyLabel: t('processing.columns.startedAt'),
        groupValuesLabel: t('processing.columns.startedAt'),
        operators: [':', '!:'],
      },
      {
        key: 'endedAtText',
        propertyLabel: t('processing.columns.endedAt'),
        groupValuesLabel: t('processing.columns.endedAt'),
        operators: [':', '!:'],
      },
      {
        key: 'errorText',
        propertyLabel: t('processing.columns.error'),
        groupValuesLabel: t('processing.columns.error'),
        operators: [':', '!:'],
      },
    ],
    [t],
  );

  const {
    items: paginatedItems,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(items, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState title={t('processing.empty.title')} subtitle={t('processing.empty.description')} />,
      noMatch: <TableEmptyState title={t('processing.noMatch.title')} subtitle={t('processing.noMatch.description')} />,
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: { sortingColumn: { sortingField: 'createdAt' }, isDescending: true },
    },
  });

  const columnDefinitions = useMemo<TableProps.ColumnDefinition<CarLogProcessingTableItem>[]>(
    () => [
      {
        id: ProcessingColumn.STATUS,
        header: t('processing.columns.status'),
        cell: (item) => <CarLogStatusIndicator status={item.status} />,
        sortingField: 'status',
        minWidth: 160,
      },
      {
        id: ProcessingColumn.DEVICE,
        header: t('processing.columns.device'),
        cell: (item) => item.deviceLabel,
        sortingField: 'deviceLabel',
        isRowHeader: true,
        minWidth: 180,
      },
      {
        id: ProcessingColumn.EVENT,
        header: t('processing.columns.event'),
        cell: (item) => item.eventLabel,
        sortingField: 'eventLabel',
        minWidth: 180,
      },
      {
        id: ProcessingColumn.STARTED,
        header: t('processing.columns.startedAt'),
        cell: (item) => item.startedAtText,
        sortingField: 'createdAt',
        minWidth: 180,
      },
      {
        id: ProcessingColumn.ENDED,
        header: t('processing.columns.endedAt'),
        cell: (item) => item.endedAtText,
        sortingField: 'endedAt',
        minWidth: 180,
      },
      {
        id: ProcessingColumn.ERROR,
        header: t('processing.columns.error'),
        cell: (item) => item.errorText,
        sortingField: 'errorText',
        minWidth: 260,
      },
    ],
    [t],
  );

  return (
    <Table<CarLogProcessingTableItem>
      {...collectionProps}
      variant="embedded"
      items={paginatedItems}
      trackBy="jobId"
      loading={isLoading}
      loadingText={t('processing.loading')}
      columnDefinitions={columnDefinitions}
      columnDisplay={preferences.contentDisplay}
      empty={<TableEmptyState title={t('processing.empty.title')} subtitle={t('processing.empty.description')} />}
      header={
        <Header
          counter={`(${filteredItemsCount ?? items.length})`}
          actions={
            <Button
              iconName="refresh"
              ariaLabel={t('processing.actions.refresh')}
              loading={isFetching}
              onClick={onRefresh}
            />
          }
        >
          {t('processing.header')}
        </Header>
      }
      pagination={
        <Pagination
          {...paginationProps}
          ariaLabels={{
            nextPageLabel: t('processing.pagination.nextPageLabel'),
            previousPageLabel: t('processing.pagination.previousPageLabel'),
            pageLabel: (pageNumber) => t('processing.pagination.pageLabel', { pageNumber }),
          }}
        />
      }
      preferences={
        <CollectionPreferences
          title={t('processing.preferences.title')}
          confirmLabel={t('processing.preferences.confirmLabel')}
          cancelLabel={t('processing.preferences.cancelLabel')}
          preferences={preferences}
          onConfirm={({ detail }) => setPreferences(detail)}
          pageSizePreference={{ title: t('processing.preferences.pageSizeTitle'), options: PAGE_SIZE_OPTIONS }}
          contentDensityPreference={{
            label: t('processing.preferences.contentDensityLabel'),
            description: t('processing.preferences.contentDensityDescription'),
          }}
          stripedRowsPreference={{
            label: t('processing.preferences.stripedRowsLabel'),
            description: t('processing.preferences.stripedRowsDescription'),
          }}
          wrapLinesPreference={{
            label: t('processing.preferences.wrapLinesLabel'),
            description: t('processing.preferences.wrapLinesDescription'),
          }}
          contentDisplayPreference={{
            title: t('processing.preferences.contentDisplayTitle'),
            options: [
              { id: ProcessingColumn.STATUS, label: t('processing.columns.status'), alwaysVisible: true },
              { id: ProcessingColumn.DEVICE, label: t('processing.columns.device') },
              { id: ProcessingColumn.EVENT, label: t('processing.columns.event') },
              { id: ProcessingColumn.STARTED, label: t('processing.columns.startedAt') },
              { id: ProcessingColumn.ENDED, label: t('processing.columns.endedAt') },
              { id: ProcessingColumn.ERROR, label: t('processing.columns.error') },
            ],
          }}
        />
      }
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={getPropertyFilterI18nStrings(tCommon, t('processing.resourceName'))}
          countText={`${filteredItemsCount ?? items.length} ${t('processing.resourceName')}`}
          expandToViewport
        />
      }
    />
  );
};

export default CarLogProcessingTable;
