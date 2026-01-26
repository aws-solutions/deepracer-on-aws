// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Link from '@cloudscape-design/components/link';
import { TableProps } from '@cloudscape-design/components/table';
import { CameraSensor, LidarSensor, Model } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import TableEmptyState from '#components/TableEmptyState';
import { PageId } from '#constants/pages';
import i18n from '#i18n/index.js';
import { getPath } from '#utils/pageUtils';

import ModelStatusIndicator from './ModelStatusIndicator';

enum ModelsTableColumn {
  MODEL_NAME = 'ModelName',
  MODEL_DESCRIPTION = 'ModelDescription',
  STATUS = 'Status',
  AGENT_ALGORITHM = 'AgentAlgorithm',
  CREATION_TIME = 'CreationTime',
  SENSORS = 'Sensors',
}

const convertSensorToString = (sensor: CameraSensor | LidarSensor) => {
  switch (sensor) {
    case CameraSensor.FRONT_FACING_CAMERA:
    case CameraSensor.LEFT_CAMERA:
    case CameraSensor.OBSERVATION_CAMERA:
      return i18n.t('models:sensors.camera');
    case CameraSensor.STEREO_CAMERAS:
      return i18n.t('models:sensors.stereoCamera');
    default:
      return i18n.t('models:sensors.lidar');
  }
};

export const useModelsTableConfig = (models: Model[]) => {
  const { t } = useTranslation('models');
  const navigate = useNavigate();

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 10, label: t('table.collectionPreferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 20, label: t('table.collectionPreferences.pageSizeOptionsLabel', { count: 20 }) },
    { value: 30, label: t('table.collectionPreferences.pageSizeOptionsLabel', { count: 30 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 10,
    visibleContent: [
      ModelsTableColumn.MODEL_NAME,
      ModelsTableColumn.MODEL_DESCRIPTION,
      ModelsTableColumn.AGENT_ALGORITHM,
      ModelsTableColumn.STATUS,
      ModelsTableColumn.CREATION_TIME,
    ],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(models, {
    filtering: {
      empty: (
        <TableEmptyState
          title={t('table.emptyTitle')}
          subtitle={t('table.emptySubtitle')}
          action={
            <Button onClick={() => navigate(getPath(PageId.CREATE_MODEL))}>{t('table.createModelButton')}</Button>
          }
        />
      ),
      noMatch: (
        <TableEmptyState
          title={t('table.noMatchTitle')}
          subtitle={t('table.noMatchSubtitle')}
          action={<Button onClick={() => actions.setFiltering('')}>{t('table.createModelButton')}</Button>}
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingComparator: (item1, item2) => item1.createdAt.getTime() - item2.createdAt.getTime(),
        },
        isDescending: true,
      },
    },
    selection: {},
  });

  const columnDefinitions: TableProps.ColumnDefinition<Model>[] = useMemo(
    () => [
      {
        id: ModelsTableColumn.MODEL_NAME,
        header: t('table.columnHeader.modelName'),
        cell: (e) => (
          <Link
            href={getPath(PageId.MODEL_DETAILS, { modelId: e.modelId })}
            onFollow={(event) => {
              event.preventDefault();
              navigate(getPath(PageId.MODEL_DETAILS, { modelId: e.modelId }));
            }}
          >
            {e.name}
          </Link>
        ),
        sortingField: 'name',
      },
      {
        id: ModelsTableColumn.MODEL_DESCRIPTION,
        header: t('table.columnHeader.modelDescription'),
        cell: (e) => e.description,
        sortingField: 'description',
      },
      {
        id: ModelsTableColumn.STATUS,
        header: t('table.columnHeader.status'),
        cell: (e) => <ModelStatusIndicator modelStatus={e.status} importErrorMessage={e.importErrorMessage} />,
        sortingField: 'status',
      },
      {
        id: ModelsTableColumn.AGENT_ALGORITHM,
        header: t('table.columnHeader.agentAlgorithm'),
        cell: (e) => e.metadata.agentAlgorithm,
        sortingComparator: (item1, item2) => item1.metadata.agentAlgorithm.localeCompare(item2.metadata.agentAlgorithm),
      },
      {
        id: ModelsTableColumn.SENSORS,
        header: t('table.columnHeader.sensors'),
        cell: (e) =>
          Object.values(e.metadata.sensors)
            .map((sensor) => convertSensorToString(sensor))
            .join(', '),
      },
      {
        id: ModelsTableColumn.CREATION_TIME,
        header: t('table.columnHeader.creationTime'),
        cell: (e) => t('table.creationTime', { date: e.createdAt }),
        sortingComparator: (item1, item2) => item1.createdAt.getTime() - item2.createdAt.getTime(),
      },
    ],
    [navigate, t],
  );

  const ModelsTablePreferences = () => (
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
            id: ModelsTableColumn.MODEL_NAME,
            label: t('table.columnHeader.modelName'),
            alwaysVisible: true,
          },
          {
            id: ModelsTableColumn.MODEL_DESCRIPTION,
            label: t('table.columnHeader.modelDescription'),
          },
          {
            id: ModelsTableColumn.AGENT_ALGORITHM,
            label: t('table.columnHeader.agentAlgorithm'),
          },
          {
            id: ModelsTableColumn.STATUS,
            label: t('table.columnHeader.status'),
          },
          {
            id: ModelsTableColumn.CREATION_TIME,
            label: t('table.columnHeader.creationTime'),
          },
        ],
      }}
    />
  );

  return {
    collectionProps,
    columnDefinitions,
    columnDisplay: preferences.contentDisplay,
    filteredItemsCount,
    filterProps,
    items,
    paginationProps,
    selectedItems: collectionProps.selectedItems,
    ModelsTablePreferences,
  };
};
