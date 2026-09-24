// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Popover from '@cloudscape-design/components/popover';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { DeploymentStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

const DeploymentStatusIndicator = ({ status, errorMessage }: { status: DeploymentStatus; errorMessage?: string }) => {
  const { t } = useTranslation('uploadStatus');
  switch (status) {
    case DeploymentStatus.COMPLETED:
      return <StatusIndicator type="success">{t('table.status.completed')}</StatusIndicator>;
    case DeploymentStatus.IN_PROGRESS:
      return <StatusIndicator type="in-progress">{t('table.status.inProgress')}</StatusIndicator>;
    case DeploymentStatus.FAILED:
      return errorMessage ? (
        <Popover content={errorMessage} dismissButton={false} position="top" size="large">
          <StatusIndicator type="error">{t('table.status.failed')}</StatusIndicator>
        </Popover>
      ) : (
        <StatusIndicator type="error">{t('table.status.failed')}</StatusIndicator>
      );
    default:
      return <StatusIndicator type="pending">{t('table.status.pending')}</StatusIndicator>;
  }
};

export default DeploymentStatusIndicator;
