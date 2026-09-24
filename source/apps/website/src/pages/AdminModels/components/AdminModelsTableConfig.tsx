// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Badge from '@cloudscape-design/components/badge';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Link from '@cloudscape-design/components/link';
import { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import Spinner from '@cloudscape-design/components/spinner';
import { TableProps } from '@cloudscape-design/components/table';
import { AdminModelExtended, ModelSource, ModelStatus } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TableEmptyState from '#components/TableEmptyState/index.js';
import ModelStatusIndicator from '#pages/Models/components/ModelStatusIndicator.js';
import OptimizationStatusIndicator from '#pages/Models/components/OptimizationStatusIndicator.js';

enum AdminModelsColumn {
  MODEL_ID = 'modelId',
  USERNAME = 'username',
  MODEL_NAME = 'name',
  TYPE = 'modelSource',
  STATUS = 'status',
  CAR_OPTIMIZED = 'optimizationStatus',
  UPLOAD_DATE = 'createdAt',
  MODEL_MD5 = 'modelMD5',
  METADATA_MD5 = 'metadataMD5',
  SENSORS = 'sensors',
  ACTION_SPACE_TYPE = 'actionSpaceType',
  TRAINING_ALGORITHM = 'trainingAlgorithm',
  DOWNLOAD = 'download',
}

const DEFAULT_VISIBLE_COLUMNS = [
  AdminModelsColumn.USERNAME,
  AdminModelsColumn.MODEL_NAME,
  AdminModelsColumn.TYPE,
  AdminModelsColumn.STATUS,
  AdminModelsColumn.CAR_OPTIMIZED,
  AdminModelsColumn.UPLOAD_DATE,
  AdminModelsColumn.DOWNLOAD,
];

const PAGE_SIZE_OPTIONS: CollectionPreferencesProps.PageSizeOption[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
];

export const useAdminModelsTableConfig = (
  models: AdminModelExtended[],
  onDownload: (model: AdminModelExtended) => void,
  downloadingId: string | null,
) => {
  const { t } = useTranslation('adminModels');

  const filteringProperties = useMemo<PropertyFilterProps.FilteringProperty[]>(
    () =>
      [
        {
          key: 'username',
          propertyLabel: t('filtering.username'),
          groupValuesLabel: t('filtering.usernameValues'),
          operators: [':', '!:', '=', '!='] as PropertyFilterProps.FilteringProperty['operators'],
        },
        {
          key: 'name',
          propertyLabel: t('filtering.modelName'),
          groupValuesLabel: t('filtering.modelNameValues'),
          operators: [':', '!:', '=', '!='] as PropertyFilterProps.FilteringProperty['operators'],
        },
        {
          key: 'modelType',
          propertyLabel: t('filtering.type'),
          groupValuesLabel: t('filtering.typeValues'),
          operators: ['=', '!='] as PropertyFilterProps.FilteringProperty['operators'],
        },
        {
          key: 'status',
          propertyLabel: t('filtering.status'),
          groupValuesLabel: t('filtering.statusValues'),
          operators: [':', '!:', '=', '!='] as PropertyFilterProps.FilteringProperty['operators'],
        },
        {
          key: 'optimizationStatus',
          propertyLabel: t('filtering.carOptimized'),
          groupValuesLabel: t('filtering.carOptimizedValues'),
          operators: [':', '!:', '=', '!='] as PropertyFilterProps.FilteringProperty['operators'],
        },
      ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel)),
    [t],
  );

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 20,
    wrapLines: false,
    stripedRows: false,
    contentDensity: 'comfortable',
    contentDisplay: DEFAULT_VISIBLE_COLUMNS.map((id) => ({ id, visible: true })),
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const enrichedModels: AdminModelExtended[] = useMemo(
    () =>
      models.map(
        (m) =>
          ({
            ...m,
            modelType:
              m.modelSource === ModelSource.IMPORTED_PHYSICAL ? t('columns.typePhysical') : t('columns.typeVirtual'),
          }) as AdminModelExtended,
      ),
    [models, t],
  );

  const { items, actions, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = useCollection(
    enrichedModels,
    {
      propertyFiltering: {
        filteringProperties: filteringProperties,
        defaultQuery: {
          tokens: [{ propertyKey: 'status', value: ModelStatus.READY, operator: '=' }],
          operation: 'and',
        },
        empty: <TableEmptyState title={t('table.empty.title')} subtitle={t('table.empty.description')} />,
        noMatch: (
          <TableEmptyState
            title={t('table.noMatch.title')}
            subtitle={t('table.noMatch.description')}
            action={
              <Button onClick={() => actions.setPropertyFiltering({ tokens: [], operation: 'and' })}>
                {t('table.noMatch.clearFilter')}
              </Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: {
        defaultState: {
          sortingColumn: { sortingField: 'createdAt' },
          isDescending: true,
        },
      },
      selection: {},
    },
  );

  const columnDefinitions: TableProps.ColumnDefinition<AdminModelExtended>[] = useMemo(
    () => [
      {
        id: AdminModelsColumn.MODEL_ID,
        header: t('columns.modelId'),
        cell: (e) => e.modelId,
        width: 180,
      },
      {
        id: AdminModelsColumn.USERNAME,
        header: t('columns.username'),
        cell: (e) => e.username || '-',
        sortingField: 'username',
        width: 150,
        minWidth: 120,
      },
      {
        id: AdminModelsColumn.MODEL_NAME,
        header: t('columns.modelName'),
        cell: (e) => e.name || '-',
        sortingField: 'name',
        width: 200,
        minWidth: 150,
      },
      {
        id: AdminModelsColumn.TYPE,
        header: t('columns.type'),
        cell: (e) =>
          e.modelSource === ModelSource.IMPORTED_PHYSICAL ? (
            <Badge color="grey">{t('columns.typePhysical')}</Badge>
          ) : (
            <Badge color="blue">{t('columns.typeVirtual')}</Badge>
          ),
        sortingField: 'modelSource',
        width: 120,
        minWidth: 100,
      },
      {
        id: AdminModelsColumn.STATUS,
        header: t('columns.status'),
        cell: (e) => <ModelStatusIndicator modelStatus={e.status} importErrorMessage={e.importErrorMessage} />,
        sortingField: 'status',
        width: 160,
        minWidth: 140,
      },
      {
        id: AdminModelsColumn.CAR_OPTIMIZED,
        header: t('columns.carOptimized'),
        cell: (e) => (
          <OptimizationStatusIndicator
            optimizationStatus={e.optimizationStatus}
            optimizationErrorMessage={e.optimizationErrorMessage}
          />
        ),
        sortingField: 'optimizationStatus',
        width: 180,
        minWidth: 140,
      },
      {
        id: AdminModelsColumn.UPLOAD_DATE,
        header: t('columns.uploadDate'),
        cell: (e) => (e.createdAt ? new Date(e.createdAt).toLocaleString() : '-'),
        sortingField: 'createdAt',
        width: 200,
        minWidth: 160,
      },
      {
        id: AdminModelsColumn.MODEL_MD5,
        header: t('columns.modelMD5'),
        cell: (e) => e.metadata?.modelMD5 || '-',
        width: 200,
        minWidth: 150,
      },
      {
        id: AdminModelsColumn.METADATA_MD5,
        header: t('columns.metadataMD5'),
        cell: (e) => e.metadata?.metadataMD5 || '-',
        width: 200,
        minWidth: 150,
      },
      {
        id: AdminModelsColumn.SENSORS,
        header: t('columns.sensors'),
        cell: (e) => (e.metadata?.sensors ? Object.values(e.metadata.sensors).join(', ') : '-'),
        width: 180,
        minWidth: 140,
      },
      {
        id: AdminModelsColumn.ACTION_SPACE_TYPE,
        header: t('columns.actionSpaceType'),
        cell: (e) => {
          if (!e.metadata?.actionSpace) return '-';
          if ('continous' in e.metadata.actionSpace) return 'Continuous';
          if ('discrete' in e.metadata.actionSpace) return 'Discrete';
          return '-';
        },
        width: 160,
        minWidth: 130,
      },
      {
        id: AdminModelsColumn.TRAINING_ALGORITHM,
        header: t('columns.trainingAlgorithm'),
        cell: (e) => e.metadata?.agentAlgorithm || '-',
        width: 180,
        minWidth: 140,
      },
      {
        id: AdminModelsColumn.DOWNLOAD,
        header: t('columns.download'),
        cell: (e) => {
          if (e.status !== ModelStatus.READY) return '-';
          if (downloadingId === e.modelId) return <Spinner />;
          return <Link onFollow={() => onDownload(e)}>{t('actions.download')}</Link>;
        },
        width: 120,
        minWidth: 100,
      },
    ],
    [t, onDownload, downloadingId],
  );

  const adminModelsPreferences = useMemo(
    () => (
      <CollectionPreferences
        title={t('preferences.title')}
        confirmLabel={t('preferences.confirm')}
        cancelLabel={t('preferences.cancel')}
        preferences={preferences}
        onConfirm={({ detail }) => setPreferences(detail)}
        pageSizePreference={{ title: t('preferences.pageSize.title'), options: PAGE_SIZE_OPTIONS }}
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
          title: t('preferences.visibleColumns.title'),
          options: [
            { id: AdminModelsColumn.MODEL_ID, label: t('columns.modelId') },
            { id: AdminModelsColumn.USERNAME, label: t('columns.username'), alwaysVisible: true },
            { id: AdminModelsColumn.MODEL_NAME, label: t('columns.modelName'), alwaysVisible: true },
            { id: AdminModelsColumn.TYPE, label: t('columns.type') },
            { id: AdminModelsColumn.STATUS, label: t('columns.status') },
            { id: AdminModelsColumn.CAR_OPTIMIZED, label: t('columns.carOptimized') },
            { id: AdminModelsColumn.UPLOAD_DATE, label: t('columns.uploadDate') },
            { id: AdminModelsColumn.MODEL_MD5, label: t('columns.modelMD5') },
            { id: AdminModelsColumn.METADATA_MD5, label: t('columns.metadataMD5') },
            { id: AdminModelsColumn.SENSORS, label: t('columns.sensors') },
            { id: AdminModelsColumn.ACTION_SPACE_TYPE, label: t('columns.actionSpaceType') },
            { id: AdminModelsColumn.TRAINING_ALGORITHM, label: t('columns.trainingAlgorithm') },
            { id: AdminModelsColumn.DOWNLOAD, label: t('columns.download') },
          ],
        }}
      />
    ),
    [t, preferences],
  );

  return {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
    columnDefinitions,
    columnDisplay: preferences.contentDisplay,
    preferences,
    adminModelsPreferences,
  };
};
