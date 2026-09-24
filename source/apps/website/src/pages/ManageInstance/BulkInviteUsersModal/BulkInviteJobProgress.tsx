// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { BulkInviteJobStatus, GetBulkInviteUserJobStatusCommandOutput } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface BulkInviteJobProgressProps {
  jobStatus: GetBulkInviteUserJobStatusCommandOutput | undefined;
  isJobTerminal: boolean;
}

const BulkInviteJobProgress = ({ jobStatus, isJobTerminal }: BulkInviteJobProgressProps) => {
  const { t } = useTranslation('manageInstance');

  if (!jobStatus) return null;

  const progress = jobStatus.totalEntries > 0 ? (jobStatus.processedCount / jobStatus.totalEntries) * 100 : 0;

  return (
    <SpaceBetween size="s">
      <ProgressBar
        value={progress}
        status={jobStatus.status === BulkInviteJobStatus.FAILED ? 'error' : undefined}
        label={
          isJobTerminal
            ? t('bulkInviteUsersModal.progress.importComplete')
            : t('bulkInviteUsersModal.progress.importing')
        }
        description={t('bulkInviteUsersModal.progress.description', {
          processedCount: jobStatus.processedCount,
          totalEntries: jobStatus.totalEntries,
          createdCount: jobStatus.createdCount,
          skippedCount: jobStatus.skippedCount,
          failedCount: jobStatus.failedCount,
        })}
      />
      {jobStatus.status === BulkInviteJobStatus.FAILED && jobStatus.errorMessage && (
        <Alert type="error" header={t('bulkInviteUsersModal.progress.importFailed')}>
          {jobStatus.errorMessage}
        </Alert>
      )}
    </SpaceBetween>
  );
};

export default BulkInviteJobProgress;
