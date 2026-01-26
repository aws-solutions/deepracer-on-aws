// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { Leaderboard, Submission } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { useSubmissionsTableConfig } from './SubmissionsTableConfig';

interface SubmissionsTableProps {
  leaderboard: Leaderboard;
  submissions: Submission[];
}

const SubmissionsTable = ({ leaderboard, submissions }: SubmissionsTableProps) => {
  const { t } = useTranslation('raceDetails');

  const {
    collectionProps,
    columnDefinitions,
    columnDisplay,
    items,
    SubmissionsTablePreferences,
    paginationProps,
    filterProps,
    filteredItemsCount,
  } = useSubmissionsTableConfig(submissions, leaderboard);

  return (
    <Table
      {...collectionProps}
      items={items}
      columnDefinitions={columnDefinitions}
      columnDisplay={columnDisplay}
      header={<Header counter={`(${submissions?.length ?? 0})`}>{t('submissionsTable.tableHeader')}</Header>}
      trackBy="submissionNumber"
      pagination={
        <Pagination
          {...paginationProps}
          ariaLabels={{
            nextPageLabel: t('submissionsTable.pagination.nextPageLabel'),
            previousPageLabel: t('submissionsTable.pagination.previousPageLabel'),
            pageLabel: (pageNumber: number) => t('submissionsTable.pagination.pageLabel', { pageNumber }),
          }}
        />
      }
      preferences={<SubmissionsTablePreferences />}
      filter={
        <TextFilter
          {...filterProps}
          filteringAriaLabel={t('submissionsTable.filters.filteringAriaLabel')}
          filteringPlaceholder={t('submissionsTable.filters.searchFilterPlaceholder')}
          countText={
            filterProps.filteringText && t('submissionsTable.filters.matchCount', { count: filteredItemsCount ?? 0 })
          }
        />
      }
    />
  );
};

export default SubmissionsTable;
