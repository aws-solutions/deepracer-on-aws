// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { BulkInviteEntryStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface BulkInviteResultStatusIndicatorProps {
  status: BulkInviteEntryStatus;
}

/**
 * Renders the per-entry outcome of a bulk invite job.
 *
 */
const BulkInviteResultStatusIndicator = ({ status }: BulkInviteResultStatusIndicatorProps) => {
  const { t } = useTranslation('manageInstance');

  switch (status) {
    case BulkInviteEntryStatus.CREATED:
      return <StatusIndicator type="success">{t('bulkInviteUsersModal.table.status.created')}</StatusIndicator>;
    case BulkInviteEntryStatus.SKIPPED:
      return <StatusIndicator type="warning">{t('bulkInviteUsersModal.table.status.skipped')}</StatusIndicator>;
    case BulkInviteEntryStatus.FAILED:
      return <StatusIndicator type="error">{t('bulkInviteUsersModal.table.status.failed')}</StatusIndicator>;
    default:
      return <StatusIndicator type="pending">{status}</StatusIndicator>;
  }
};

export default BulkInviteResultStatusIndicator;
