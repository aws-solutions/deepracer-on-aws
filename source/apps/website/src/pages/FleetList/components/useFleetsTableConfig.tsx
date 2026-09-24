// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import { TableProps } from '@cloudscape-design/components/table';
import { Fleet } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TableEmptyState from '#components/TableEmptyState';
import { formatTimestampWithTimeZone } from '#utils/dateTimeUtils.js';

import { DEFAULT_PAGE_SIZE, FleetsTableColumn } from './fleetsTableConstants.js';

export const useFleetsTableConfig = (fleets: Fleet[]) => {
  const { t } = useTranslation('fleets');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const columnDefinitions: TableProps.ColumnDefinition<Fleet>[] = useMemo(
    () => [
      {
        id: FleetsTableColumn.NAME,
        header: t('list.columnHeaders.name'),
        cell: (item) => item.name,
        sortingField: 'name',
        isRowHeader: true,
      },
      {
        id: FleetsTableColumn.DEVICE_COUNT,
        header: t('list.columnHeaders.deviceCount'),
        cell: (item) => item.deviceCount ?? 0,
        sortingField: 'deviceCount',
      },
      {
        id: FleetsTableColumn.CREATED_AT,
        header: t('list.columnHeaders.createdAt'),
        cell: (item) => formatTimestampWithTimeZone(item.createdAt),
        sortingField: 'createdAt',
      },
    ],
    [t],
  );

  const { items, collectionProps, filterProps, paginationProps, filteredItemsCount } = useCollection(fleets, {
    filtering: {
      filteringFunction: (item, filteringText) => {
        const text = filteringText.toLowerCase();
        return item.name.toLowerCase().includes(text);
      },
    },
    pagination: { pageSize },
    sorting: {},
    selection: {},
  });

  return {
    collectionProps,
    columnDefinitions,
    items,
    paginationProps,
    selectedItems: collectionProps.selectedItems as Fleet[],
    filterProps,
    filteredItemsCount,
    pageSize,
    setPageSize,
    emptyState: <TableEmptyState title={t('list.emptyTitle')} subtitle={t('list.emptySubtitle')} />,
  };
};
