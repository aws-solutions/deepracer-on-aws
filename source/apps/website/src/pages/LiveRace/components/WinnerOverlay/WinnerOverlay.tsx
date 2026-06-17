// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from 'react-i18next';

import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

import './styles.css';

export interface Winner {
  participantName: string;
  modelName: string;
  bestLapTime: number;
  rank: number;
  avatar: object;
}

interface WinnerOverlayProps {
  winner: Winner | null;
  onDismiss?: () => void;
}

/**
 * Displays a prominent winner announcement when the facilitator declares a winner.
 * Renders as an overlay on top of the live race content.
 */
const WinnerOverlay = ({ winner, onDismiss }: WinnerOverlayProps) => {
  const { t } = useTranslation('liveRace');

  if (!winner) return null;

  return (
    <div className="winnerOverlay" data-testid="winner-overlay">
      <div className="winnerContent">
        <SpaceBetween size="m" alignItems="center">
          <Box variant="h1" color="inherit" textAlign="center">
            {t('winnerOverlay.title')}
          </Box>
          <Box variant="h2" color="inherit" textAlign="center">
            {winner.participantName}
          </Box>
          <Box color="inherit" textAlign="center">
            {winner.modelName}
          </Box>
          <Box variant="h3" color="inherit" textAlign="center">
            {t('winnerOverlay.time', { time: millisToMinutesAndSeconds(winner.bestLapTime) })}
          </Box>
          {onDismiss && (
            <Button variant="link" onClick={onDismiss} data-testid="winner-overlay-dismiss">
              {t('winnerOverlay.dismiss')}
            </Button>
          )}
        </SpaceBetween>
      </div>
    </div>
  );
};

export default WinnerOverlay;
