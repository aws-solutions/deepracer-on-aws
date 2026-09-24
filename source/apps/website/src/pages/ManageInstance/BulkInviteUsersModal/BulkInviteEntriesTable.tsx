// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Box from '@cloudscape-design/components/box';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Pagination from '@cloudscape-design/components/pagination';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { BulkInviteEntryStatus } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import BulkInviteResultStatusIndicator from './BulkInviteResultStatusIndicator.js';

/**
 * A row in the single, persistent entries table.
 */
export interface BulkInviteRow {
  emailAddress: string;
  displayName?: string;
  /** 'PENDING' is UI-only (not a wire value) — shown before this row's result has arrived. */
  status: 'PENDING' | BulkInviteEntryStatus;
  reason?: string;
}

interface BulkInviteEntriesTableProps {
  rows: BulkInviteRow[];
}

const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_VALUES = [5, 10, 15, 25, 50, 100];

/**
 * Renders the status cell for a bulk invite row.
 */
const renderStatusCell = (item: BulkInviteRow, pendingLabel: string) =>
  item.status === 'PENDING' ? (
    <StatusIndicator type="pending">{pendingLabel}</StatusIndicator>
  ) : (
    <BulkInviteResultStatusIndicator status={item.status} />
  );

const BulkInviteEntriesTable = ({ rows }: BulkInviteEntriesTableProps) => {
  const { t } = useTranslation('manageInstance');

  const [tablePreferences, setTablePreferences] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const {
    items: tableItems,
    collectionProps: tableCollectionProps,
    paginationProps: tablePaginationProps,
  } = useCollection<BulkInviteRow>(rows, {
    pagination: { pageSize: tablePreferences.pageSize },
  });

  if (rows.length === 0) return null;

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = PAGE_SIZE_VALUES.map((value) => ({
    value,
    label: t('bulkInviteUsersModal.table.preferences.pageSizeOptionsLabel', { count: value }),
  }));

  const paginationAriaLabels = {
    nextPageLabel: t('bulkInviteUsersModal.table.pagination.nextPageLabel'),
    previousPageLabel: t('bulkInviteUsersModal.table.pagination.previousPageLabel'),
    pageLabel: (pageNumber: number) => t('bulkInviteUsersModal.table.pagination.pageLabel', { pageNumber }),
  };

  return (
    <Table
      {...tableCollectionProps}
      data-testid="bulk-invite-entries-table"
      header={
        <Box variant="awsui-key-label">{t('bulkInviteUsersModal.table.entriesCount', { count: rows.length })}</Box>
      }
      columnDefinitions={[
        {
          id: 'emailAddress',
          header: t('bulkInviteUsersModal.table.columns.email'),
          // Rendered as plain JSX text (never dangerouslySetInnerHTML), so React escapes it
          // automatically
          cell: (item) => item.emailAddress,
        },
        {
          id: 'displayName',
          header: t('bulkInviteUsersModal.table.columns.displayName'),
          cell: (item) => item.displayName ?? t('bulkInviteUsersModal.table.empty_value'),
        },
        {
          id: 'status',
          header: t('bulkInviteUsersModal.table.columns.status'),
          cell: (item) => renderStatusCell(item, t('bulkInviteUsersModal.table.status.pending')),
        },
        {
          id: 'reason',
          header: t('bulkInviteUsersModal.table.columns.reason'),
          cell: (item) => item.reason ?? t('bulkInviteUsersModal.table.empty_value'),
        },
      ]}
      items={tableItems}
      variant="embedded"
      resizableColumns
      pagination={<Pagination {...tablePaginationProps} ariaLabels={paginationAriaLabels} />}
      preferences={
        <CollectionPreferences
          title={t('bulkInviteUsersModal.table.preferences.title')}
          confirmLabel={t('bulkInviteUsersModal.table.preferences.confirm')}
          cancelLabel={t('bulkInviteUsersModal.table.preferences.cancel')}
          preferences={tablePreferences}
          onConfirm={({ detail }) => setTablePreferences(detail)}
          pageSizePreference={{
            title: t('bulkInviteUsersModal.table.preferences.pageSizeTitle'),
            options: pageSizeOptions,
          }}
        />
      }
    />
  );
};

export default BulkInviteEntriesTable;
