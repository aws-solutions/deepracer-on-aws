// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RaceInfoPanelProps {
  liveEventTime: string | null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Displays race configuration and status as a compact inline bar.
 */
const RaceInfoPanel = ({ liveEventTime }: RaceInfoPanelProps) => {
  const { t } = useTranslation('liveRace');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!liveEventTime) return;
    const target = new Date(liveEventTime).getTime();
    const update = () => {
      const remaining = target - Date.now();
      setCountdown(remaining > 0 ? formatCountdown(remaining) : '');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [liveEventTime]);

  return (
    <div data-testid="race-info-panel">
      <SpaceBetween size="m" direction="horizontal">
        {countdown && (
          <Box variant="small" fontWeight="bold">
            <Box variant="awsui-key-label" display="inline">
              {t('raceInfoPanel.startsIn')}:
            </Box>{' '}
            {countdown}
          </Box>
        )}
      </SpaceBetween>
    </div>
  );
};

export default RaceInfoPanel;
