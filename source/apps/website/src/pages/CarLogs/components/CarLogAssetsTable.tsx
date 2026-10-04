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
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { CarLogAsset, CarLogAssetType } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPropertyFilterI18nStrings } from '#components/PropertyFilterI18nStrings/index.js';
import TableEmptyState from '#components/TableEmptyState';
import { canDeleteCarLogs, canDownloadCarLogs, canManageCarLogJobs, type CarLogsAccess } from '#utils/carLogsAccess.js';

import { formatCarLogDateTime, formatCarLogDuration, formatCarLogModels } from '../utils.js';

enum AssetsColumn {
  TYPE = 'type',
  FILENAME = 'filename',
  USER = 'user',
  MODELS = 'models',
  EVENT = 'event',
  CAR = 'car',
  UPLOADED = 'uploaded',
  DURATION = 'duration',
}

interface CarLogAssetTableItem extends CarLogAsset {
  typeLabel: string;
  userLabel: string;
  modelsText: string;
  eventLabel: string;
  carLabel: string;
  uploadedAtText: string;
  durationLabel: string;
  durationSeconds: number;
}

interface CarLogAssetsTableProps {
  access: CarLogsAccess | undefined;
  assets: CarLogAsset[];
  isFetching: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onRequestDelete: (assets: CarLogAsset[]) => void;
  onRequestDownload: (assets: CarLogAsset[]) => void;
  onRequestUpload: () => void;
}

const PAGE_SIZE_OPTIONS: CollectionPreferencesProps.PageSizeOption[] = [10, 25, 50].map((value) => ({
  value,
  label: value.toString(),
}));

const DEFAULT_CONTENT_DISPLAY: CollectionPreferencesProps.ContentDisplayItem[] = [
  { id: AssetsColumn.TYPE, visible: true },
  { id: AssetsColumn.FILENAME, visible: true },
  { id: AssetsColumn.USER, visible: true },
  { id: AssetsColumn.MODELS, visible: true },
  { id: AssetsColumn.EVENT, visible: true },
  { id: AssetsColumn.CAR, visible: true },
  { id: AssetsColumn.UPLOADED, visible: true },
  { id: AssetsColumn.DURATION, visible: true },
];

const ASSET_TYPE_TRANSLATION_KEY: Record<
  CarLogAssetType,
  'assetTypes.VIDEO' | 'assetTypes.BAG_MCAP' | 'assetTypes.BAG_SQLITE'
> = {
  [CarLogAssetType.VIDEO]: 'assetTypes.VIDEO',
  [CarLogAssetType.BAG_MCAP]: 'assetTypes.BAG_MCAP',
  [CarLogAssetType.BAG_SQLITE]: 'assetTypes.BAG_SQLITE',
};

const CarLogAssetsTable = ({
  access,
  assets,
  isFetching,
  isLoading,
  onRefresh,
  onRequestDelete,
  onRequestDownload,
  onRequestUpload,
}: CarLogAssetsTableProps) => {
  const { t } = useTranslation('carLogs');
  const { t: tCommon } = useTranslation('common');
  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: 10,
    contentDisplay: DEFAULT_CONTENT_DISPLAY,
    stripedRows: false,
    contentDensity: 'comfortable',
    wrapLines: false,
  });

  const canSelect = access === 'manager' || access === 'racer';
  const canUpload = canManageCarLogJobs(access);
  const canDownload = canDownloadCarLogs(access);
  const canDelete = canDeleteCarLogs(access);

  const items = useMemo<CarLogAssetTableItem[]>(
    () =>
      assets.map((asset) => ({
        ...asset,
        typeLabel: t(ASSET_TYPE_TRANSLATION_KEY[asset.type]),
        userLabel: asset.racerName ?? asset.profileId,
        modelsText: formatCarLogModels(asset.models),
        eventLabel: asset.eventName ?? asset.eventId ?? '—',
        carLabel: asset.carName ?? '—',
        uploadedAtText: formatCarLogDateTime(asset.uploadedAt),
        durationLabel: formatCarLogDuration(asset.mediaMetadata?.durationSeconds),
        durationSeconds: asset.mediaMetadata?.durationSeconds ?? -1,
      })),
    [assets, t],
  );

  const filteringProperties = useMemo<PropertyFilterProps.FilteringProperty[]>(
    () => [
      {
        key: 'typeLabel',
        propertyLabel: t('assets.columns.type'),
        groupValuesLabel: t('assets.columns.type'),
        operators: ['=', '!='],
      },
      {
        key: 'filename',
        propertyLabel: t('assets.columns.filename'),
        groupValuesLabel: t('assets.columns.filename'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'userLabel',
        propertyLabel: t('assets.columns.user'),
        groupValuesLabel: t('assets.columns.user'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'modelsText',
        propertyLabel: t('assets.columns.models'),
        groupValuesLabel: t('assets.columns.models'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'eventLabel',
        propertyLabel: t('assets.columns.event'),
        groupValuesLabel: t('assets.columns.event'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'carLabel',
        propertyLabel: t('assets.columns.car'),
        groupValuesLabel: t('assets.columns.car'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'uploadedAtText',
        propertyLabel: t('assets.columns.uploadedAt'),
        groupValuesLabel: t('assets.columns.uploadedAt'),
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
      empty: <TableEmptyState title={t('assets.empty.title')} subtitle={t('assets.empty.description')} />,
      noMatch: <TableEmptyState title={t('assets.noMatch.title')} subtitle={t('assets.noMatch.description')} />,
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: { sortingColumn: { sortingField: 'uploadedAt' }, isDescending: true },
    },
    selection: {},
  });

  const selectedItems = (collectionProps.selectedItems ?? []) as CarLogAssetTableItem[];

  const columnDefinitions = useMemo<TableProps.ColumnDefinition<CarLogAssetTableItem>[]>(
    () => [
      {
        id: AssetsColumn.TYPE,
        header: t('assets.columns.type'),
        cell: (item) => item.typeLabel,
        sortingField: 'typeLabel',
        minWidth: 140,
      },
      {
        id: AssetsColumn.FILENAME,
        header: t('assets.columns.filename'),
        cell: (item) => item.filename,
        sortingField: 'filename',
        isRowHeader: true,
        minWidth: 220,
      },
      {
        id: AssetsColumn.USER,
        header: t('assets.columns.user'),
        cell: (item) => item.userLabel,
        sortingField: 'userLabel',
        minWidth: 180,
      },
      {
        id: AssetsColumn.MODELS,
        header: t('assets.columns.models'),
        cell: (item) => item.modelsText,
        sortingField: 'modelsText',
        minWidth: 220,
      },
      {
        id: AssetsColumn.EVENT,
        header: t('assets.columns.event'),
        cell: (item) => item.eventLabel,
        sortingField: 'eventLabel',
        minWidth: 180,
      },
      {
        id: AssetsColumn.CAR,
        header: t('assets.columns.car'),
        cell: (item) => item.carLabel,
        sortingField: 'carLabel',
        minWidth: 160,
      },
      {
        id: AssetsColumn.UPLOADED,
        header: t('assets.columns.uploadedAt'),
        cell: (item) => item.uploadedAtText,
        sortingField: 'uploadedAt',
        minWidth: 180,
      },
      {
        id: AssetsColumn.DURATION,
        header: t('assets.columns.duration'),
        cell: (item) => (item.type === CarLogAssetType.VIDEO ? item.durationLabel : '—'),
        sortingComparator: (a, b) => a.durationSeconds - b.durationSeconds,
        minWidth: 140,
      },
    ],
    [t],
  );

  const visibleCount = filteredItemsCount ?? items.length;

  return (
    <Table<CarLogAssetTableItem>
      {...collectionProps}
      variant="embedded"
      items={paginatedItems}
      trackBy="assetId"
      loading={isLoading}
      loadingText={t('assets.loading')}
      columnDefinitions={columnDefinitions}
      columnDisplay={preferences.contentDisplay}
      selectionType={canSelect ? 'multi' : undefined}
      resizableColumns
      header={
        <Header
          counter={selectedItems.length ? `(${selectedItems.length}/${visibleCount})` : `(${visibleCount})`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                iconName="refresh"
                ariaLabel={t('assets.actions.refresh')}
                loading={isFetching}
                onClick={onRefresh}
              />
              {canUpload && <Button onClick={onRequestUpload}>{t('assets.actions.upload')}</Button>}
              {canDownload && (
                <Button disabled={selectedItems.length === 0} onClick={() => onRequestDownload(selectedItems)}>
                  {t('assets.actions.download')}
                </Button>
              )}
              {canDelete && (
                <Button disabled={selectedItems.length === 0} onClick={() => onRequestDelete(selectedItems)}>
                  {t('assets.actions.delete')}
                </Button>
              )}
            </SpaceBetween>
          }
        >
          {t('assets.header')}
        </Header>
      }
      empty={<TableEmptyState title={t('assets.empty.title')} subtitle={t('assets.empty.description')} />}
      pagination={
        <Pagination
          {...paginationProps}
          ariaLabels={{
            nextPageLabel: t('assets.pagination.nextPageLabel'),
            previousPageLabel: t('assets.pagination.previousPageLabel'),
            pageLabel: (pageNumber) => t('assets.pagination.pageLabel', { pageNumber }),
          }}
        />
      }
      preferences={
        <CollectionPreferences
          title={t('assets.preferences.title')}
          confirmLabel={t('assets.preferences.confirmLabel')}
          cancelLabel={t('assets.preferences.cancelLabel')}
          preferences={preferences}
          onConfirm={({ detail }) => setPreferences(detail)}
          pageSizePreference={{ title: t('assets.preferences.pageSizeTitle'), options: PAGE_SIZE_OPTIONS }}
          contentDensityPreference={{
            label: t('assets.preferences.contentDensityLabel'),
            description: t('assets.preferences.contentDensityDescription'),
          }}
          stripedRowsPreference={{
            label: t('assets.preferences.stripedRowsLabel'),
            description: t('assets.preferences.stripedRowsDescription'),
          }}
          wrapLinesPreference={{
            label: t('assets.preferences.wrapLinesLabel'),
            description: t('assets.preferences.wrapLinesDescription'),
          }}
          contentDisplayPreference={{
            title: t('assets.preferences.contentDisplayTitle'),
            options: [
              { id: AssetsColumn.TYPE, label: t('assets.columns.type') },
              { id: AssetsColumn.FILENAME, label: t('assets.columns.filename'), alwaysVisible: true },
              { id: AssetsColumn.USER, label: t('assets.columns.user') },
              { id: AssetsColumn.MODELS, label: t('assets.columns.models') },
              { id: AssetsColumn.EVENT, label: t('assets.columns.event') },
              { id: AssetsColumn.CAR, label: t('assets.columns.car') },
              { id: AssetsColumn.UPLOADED, label: t('assets.columns.uploadedAt') },
              { id: AssetsColumn.DURATION, label: t('assets.columns.duration') },
            ],
          }}
        />
      }
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={getPropertyFilterI18nStrings(tCommon, t('assets.resourceName'))}
          countText={`${filteredItemsCount ?? items.length} ${t('assets.resourceName')}`}
          expandToViewport
        />
      }
    />
  );
};

export default CarLogAssetsTable;
