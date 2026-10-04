// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

const STATUS_TYPE_MAP: Record<CarLogFetchStatus, StatusIndicatorProps.Type> = {
  [CarLogFetchStatus.CREATED]: 'pending',
  [CarLogFetchStatus.REQUESTED_UPLOAD]: 'in-progress',
  [CarLogFetchStatus.WAITING_FOR_UPLOAD]: 'in-progress',
  [CarLogFetchStatus.UPLOAD_FAILED]: 'error',
  [CarLogFetchStatus.UPLOADED]: 'success',
  [CarLogFetchStatus.ANALYZED]: 'success',
  [CarLogFetchStatus.QUEUED_FOR_PROCESSING]: 'in-progress',
  [CarLogFetchStatus.PROCESSING]: 'in-progress',
  [CarLogFetchStatus.DONE]: 'success',
  [CarLogFetchStatus.FAILED]: 'error',
};

interface CarLogStatusIndicatorProps {
  status: CarLogFetchStatus;
}

const CarLogStatusIndicator = ({ status }: CarLogStatusIndicatorProps) => {
  const { t } = useTranslation('carLogs');

  return <StatusIndicator type={STATUS_TYPE_MAP[status]}>{t(`status.${status}`)}</StatusIndicator>;
};

export default CarLogStatusIndicator;
