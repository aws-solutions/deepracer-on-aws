// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Flashbar, { FlashbarProps } from '@cloudscape-design/components/flashbar';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { RaceStatus } from '../../types';

interface RaceStatusBannerProps {
  status: RaceStatus | null;
}

const STATUS_TYPE_MAP: Record<RaceStatus, FlashbarProps.Type> = {
  SUBMISSIONS_OPEN: 'info',
  SUBMISSIONS_CLOSED: 'warning',
  IN_PROGRESS: 'success',
  COMPLETED: 'success',
};

/**
 * Displays a banner showing the current race status.
 * Triggered by RACE_STATUS_CHANGED and WINNER_DECLARED events.
 */
const RaceStatusBanner = ({ status }: RaceStatusBannerProps) => {
  const { t } = useTranslation('liveRace');
  const [dismissedStatus, setDismissedStatus] = useState<string | null>(null);

  const items: FlashbarProps.MessageDefinition[] = useMemo(() => {
    if (!status || status === dismissedStatus) return [];

    return [
      {
        type: STATUS_TYPE_MAP[status],
        content: t(`raceStatusBanner.${status}`),
        dismissible: true,
        dismissLabel: t('raceStatusBanner.dismiss'),
        onDismiss: () => setDismissedStatus(status),
        id: `race-status-${status}`,
      },
    ];
  }, [status, dismissedStatus, t]);

  if (!status || status === dismissedStatus) return null;

  return <Flashbar items={items} data-testid="race-status-banner" />;
};

export default RaceStatusBanner;
