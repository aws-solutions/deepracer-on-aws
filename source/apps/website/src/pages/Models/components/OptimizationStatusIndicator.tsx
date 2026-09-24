// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Popover from '@cloudscape-design/components/popover';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { OptimizationStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface OptimizationStatusIndicatorProps {
  optimizationStatus?: OptimizationStatus;
  optimizationErrorMessage?: string;
}

const OptimizationStatusIndicator = ({
  optimizationStatus,
  optimizationErrorMessage,
}: OptimizationStatusIndicatorProps) => {
  const { t } = useTranslation('models', { keyPrefix: 'table.carOptimized' });

  switch (optimizationStatus) {
    case OptimizationStatus.OPTIMIZED:
      return (
        <Popover size="medium" position="top" dismissButton={false} content={t('optimizedInfo')}>
          <StatusIndicator type="success">{t('complete')}</StatusIndicator>
        </Popover>
      );
    case OptimizationStatus.IN_PROGRESS:
      return (
        <Popover size="medium" position="top" dismissButton={false} content={t('inProgressInfo')}>
          <StatusIndicator type="in-progress" colorOverride="blue">
            {t('inProgress')}
          </StatusIndicator>
        </Popover>
      );
    case OptimizationStatus.FAILED:
      if (optimizationErrorMessage) {
        return (
          <StatusIndicator type="error">
            <Popover
              header={t('failedInfoTitle')}
              size="large"
              position="right"
              dismissButton={false}
              content={optimizationErrorMessage}
            >
              <Box display="inline" color="inherit">
                {t('failed')}
              </Box>
            </Popover>
          </StatusIndicator>
        );
      }
      return <StatusIndicator type="error">{t('failed')}</StatusIndicator>;
    default:
      return (
        <Popover size="medium" position="top" dismissButton={false} content={t('notOptimizedInfo')}>
          <StatusIndicator type="pending">{t('notOptimized')}</StatusIndicator>
        </Popover>
      );
  }
};

export default OptimizationStatusIndicator;
