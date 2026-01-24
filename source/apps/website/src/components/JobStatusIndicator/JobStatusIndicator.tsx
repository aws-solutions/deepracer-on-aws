// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box, { BoxProps } from '@cloudscape-design/components/box';
import StatusIndicator, { StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import { JobStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface JobStatusIndicatorProps {
  status: JobStatus;
  fontSize?: BoxProps['fontSize'];
  fontWeight?: BoxProps['fontWeight'];
}

const JobStatusIndicator = ({ fontSize, fontWeight, status }: JobStatusIndicatorProps) => {
  const { t } = useTranslation('common', { keyPrefix: 'jobStatus' });

  let statusType: StatusIndicatorProps['type'];
  let colorOverride: StatusIndicatorProps['colorOverride'];

  switch (status) {
    case JobStatus.CANCELED:
      statusType = 'stopped';
      break;
    case JobStatus.COMPLETED:
      statusType = 'success';
      break;
    case JobStatus.FAILED:
      statusType = 'error';
      break;
    case JobStatus.QUEUED:
      statusType = 'pending';
      break;
    case JobStatus.IN_PROGRESS:
    case JobStatus.INITIALIZING:
    case JobStatus.STOPPING:
    default:
      colorOverride = 'blue';
      statusType = 'in-progress';
      break;
  }

  return (
    <StatusIndicator type={statusType} colorOverride={colorOverride}>
      <Box fontWeight={fontWeight} fontSize={fontSize} display="inline" color="inherit">
        {t(status)}
      </Box>
    </StatusIndicator>
  );
};

export default JobStatusIndicator;
