// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Popover from '@cloudscape-design/components/popover';
import StatusIndicator, { StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import { ModelStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface ModelStatusIndicatorProps {
  modelStatus: ModelStatus;
  importErrorMessage?: string;
}

const ModelStatusIndicator = ({ modelStatus, importErrorMessage }: ModelStatusIndicatorProps) => {
  const { t } = useTranslation('common', { keyPrefix: 'modelStatus' });

  let statusType: StatusIndicatorProps['type'];
  let colorOverride: StatusIndicatorProps['colorOverride'];

  switch (modelStatus) {
    case ModelStatus.READY:
      statusType = 'success';
      break;
    case ModelStatus.QUEUED:
      statusType = 'pending';
      break;
    case ModelStatus.TRAINING:
    case ModelStatus.STOPPING:
    case ModelStatus.EVALUATING:
    case ModelStatus.IMPORTING:
    case ModelStatus.DELETING:
      colorOverride = 'blue';
      statusType = 'in-progress';
      break;
    case ModelStatus.ERROR:
      statusType = 'error';
      break;
    default:
      colorOverride = 'blue';
      statusType = 'info';
      break;
  }

  if (modelStatus === ModelStatus.ERROR && importErrorMessage) {
    return (
      <StatusIndicator type={statusType} colorOverride={colorOverride}>
        <Popover header="Import Error" size="large" position="right" dismissButton={false} content={importErrorMessage}>
          <Box display="inline" color="inherit">
            {t(modelStatus)}
          </Box>
        </Popover>
      </StatusIndicator>
    );
  }

  return (
    <StatusIndicator type={statusType} colorOverride={colorOverride}>
      <Box display="inline" color="inherit">
        {t(modelStatus)}
      </Box>
    </StatusIndicator>
  );
};

export default ModelStatusIndicator;
