// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Table, { TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Evaluation, ModelStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import TableEmptyState from '#components/TableEmptyState';
import { PageId } from '#constants/pages';
import { getBestLapTime } from '#pages/ModelDetails/components/EvaluationTab/utils';
import { getPath } from '#utils/pageUtils';
import { getTrackById } from '#utils/trackUtils';

interface EvaluationsTableProps {
  evaluations: Evaluation[];
  isEvaluationsLoading: boolean;
  loadedEvaluationId?: string;
  modelId: string;
  onLoadEvaluation: (evaluationId: string) => void;
  trainingStatus: ModelStatus;
}

enum EvaluationsTableColumn {
  EVALUATION_NAME = 'evaluationName',
  EVALUATION_DATE = 'evaluationDate',
  LAP_TIME = 'lapTime',
  TRACK = 'track',
  RACE_TYPE = 'raceType',
}

const EvaluationsTable = ({
  evaluations,
  isEvaluationsLoading,
  loadedEvaluationId,
  modelId,
  onLoadEvaluation,
  trainingStatus,
}: EvaluationsTableProps) => {
  const navigate = useNavigate();
  const { t: commonT } = useTranslation('common');
  const { t } = useTranslation('modelDetails', { keyPrefix: 'evaluationsTable' });

  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: 10,
    contentDisplay: [
      { id: EvaluationsTableColumn.EVALUATION_NAME, visible: true },
      { id: EvaluationsTableColumn.EVALUATION_DATE, visible: true },
      { id: EvaluationsTableColumn.LAP_TIME, visible: true },
      { id: EvaluationsTableColumn.TRACK, visible: true },
      { id: EvaluationsTableColumn.RACE_TYPE, visible: true },
    ],
  });

  const columnDefinitions: TableProps.ColumnDefinition<Evaluation>[] = useMemo(
    () => [
      {
        id: EvaluationsTableColumn.EVALUATION_NAME,
        header: t('columnHeaders.name'),
        cell: (e) => e.config.evaluationName,
        sortingComparator: (a, b) => a.config.evaluationName.localeCompare(b.config.evaluationName),
      },
      {
        id: EvaluationsTableColumn.EVALUATION_DATE,
        header: t('columnHeaders.evaluationDate'),
        cell: (e) => e.createdAt.toLocaleDateString(),
        sortingComparator: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      },
      {
        id: EvaluationsTableColumn.LAP_TIME,
        header: t('columnHeaders.lapTime'),
        cell: (e) => getBestLapTime(e.metrics),
        sortingComparator: (a, b) => getBestLapTime(a.metrics).localeCompare(getBestLapTime(b.metrics)),
      },
      {
        id: EvaluationsTableColumn.TRACK,
        header: t('columnHeaders.track'),
        cell: (e) => getTrackById(e.config.trackConfig.trackId).name,
        sortingComparator: (a, b) =>
          getTrackById(a.config.trackConfig.trackId).name.localeCompare(
            getTrackById(b.config.trackConfig.trackId).name,
          ),
      },
      {
        id: EvaluationsTableColumn.RACE_TYPE,
        header: t('columnHeaders.raceType'),
        cell: (e) => commonT(`raceType.${e.config.raceType}`),
        sortingComparator: (a, b) => a.config.raceType.localeCompare(b.config.raceType),
      },
    ],
    [commonT, t],
  );

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    evaluations,
    {
      filtering: {
        empty: (
          <TableEmptyState
            title={t('empty.title')}
            subtitle={t('empty.subtitle')}
            action={
              <Button
                disabled={trainingStatus !== ModelStatus.READY}
                onClick={() => navigate(getPath(PageId.CREATE_EVALUATION, { modelId }))}
              >
                {t('empty.action')}
              </Button>
            }
          />
        ),
        noMatch: (
          <TableEmptyState
            title={t('noMatch.title')}
            subtitle={t('noMatch.subtitle')}
            action={<Button onClick={() => actions.setFiltering('')}>{t('noMatch.action')}</Button>}
          />
        ),
        filteringFunction: (item, filteringText) =>
          !filteringText.length ||
          item.config.evaluationName.toLowerCase().includes(filteringText.toLowerCase()) ||
          commonT(`raceType.${item.config.raceType}`).toLowerCase().includes(filteringText.toLowerCase()) ||
          getTrackById(item.config.trackConfig.trackId).name.toLowerCase().includes(filteringText.toLowerCase()),
      },
      pagination: { pageSize: preferences.pageSize },
      selection: {
        defaultSelectedItems: evaluations[0] ? [evaluations[0]] : undefined,
        keepSelection: true,
        trackBy: 'evaluationId',
      },
      sorting: {
        defaultState: {
          sortingColumn: useMemo(() => columnDefinitions[1], [columnDefinitions]),
          isDescending: true,
        },
      },
    },
  );

  const { selectedItems } = collectionProps;
  const selectedEvaluation = selectedItems?.[0];

  // Handle evaluations not being loaded on initial render
  useEffect(() => {
    if (evaluations.length && !selectedEvaluation) {
      actions.setSelectedItems([evaluations[0]]);
      onLoadEvaluation(evaluations[0].evaluationId);
    }
  });

  return (
    <Table
      {...collectionProps}
      resizableColumns
      items={items}
      columnDisplay={preferences.contentDisplay}
      columnDefinitions={columnDefinitions}
      loading={isEvaluationsLoading}
      loadingText={t('loadingText')}
      selectionType="single"
      variant="container"
      header={
        <Header
          counter={selectedEvaluation ? `(1/${evaluations.length})` : `(${evaluations.length})`}
          actions={
            <Button
              disabled={!selectedEvaluation || selectedEvaluation.evaluationId === loadedEvaluationId}
              onClick={() => {
                onLoadEvaluation((selectedEvaluation as Evaluation).evaluationId);
              }}
            >
              {t('actions.loadEvaluation')}
            </Button>
          }
        >
          {t('header')}
        </Header>
      }
      filter={
        <TextFilter
          {...filterProps}
          filteringPlaceholder={t('filter.placeholder')}
          filteringAriaLabel={t('filter.ariaLabel')}
          countText={filterProps.filteringText && t('filter.matchCount', { count: filteredItemsCount ?? 0 })}
        />
      }
      pagination={
        <Pagination
          {...paginationProps}
          ariaLabels={{
            nextPageLabel: t('pagination.nextPageLabel'),
            previousPageLabel: t('pagination.previousPageLabel'),
            pageLabel: (pageNumber: number) => t('pagination.pageLabel', { pageNumber }),
          }}
        />
      }
      preferences={
        <CollectionPreferences
          preferences={preferences}
          onConfirm={({ detail }) => setPreferences(detail)}
          confirmLabel={t('preferences.confirmLabel')}
          cancelLabel={t('preferences.cancelLabel')}
          pageSizePreference={{
            title: t('preferences.pageSize.title'),
            options: [
              { value: 10, label: t('preferences.pageSize.optionsLabel', { count: 10 }) },
              { value: 20, label: t('preferences.pageSize.optionsLabel', { count: 20 }) },
              { value: 30, label: t('preferences.pageSize.optionsLabel', { count: 30 }) },
            ],
          }}
          contentDisplayPreference={{
            title: t('preferences.contentDisplay.title'),
            description: t('preferences.contentDisplay.description'),
            options: [
              {
                id: EvaluationsTableColumn.EVALUATION_NAME,
                label: t('columnHeaders.name'),
                alwaysVisible: true,
              },
              {
                id: EvaluationsTableColumn.EVALUATION_DATE,
                label: t('columnHeaders.evaluationDate'),
              },
              {
                id: EvaluationsTableColumn.LAP_TIME,
                label: t('columnHeaders.lapTime'),
              },
              {
                id: EvaluationsTableColumn.TRACK,
                label: t('columnHeaders.track'),
              },
              {
                id: EvaluationsTableColumn.RACE_TYPE,
                label: t('columnHeaders.raceType'),
              },
            ],
          }}
        />
      }
    />
  );
};

export default EvaluationsTable;
