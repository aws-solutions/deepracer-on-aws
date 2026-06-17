// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useTranslation } from 'react-i18next';

import VideoStreamPlayer from '#components/VideoStreamPlayer';

import './styles.css';

interface VideoPanelProps {
  streamUrl: string | null;
  participantName: string;
  modelName: string;
  allComplete?: boolean;
  hasFailed?: boolean;
  winnerDeclared?: boolean;
  waitingForLaunch?: boolean;
  isExecutionRunning?: boolean;
}

/**
 * Wraps the existing VideoStreamPlayer for live race viewing.
 * Shows the video stream when a URL is available, or a transition
 * screen between evaluations when no stream is active.
 *
 * Uses `key` on VideoStreamPlayer to force remount when the stream
 * URL changes, which destroys the old HLS instance and creates a new one.
 */
const VideoPanel = ({
  streamUrl,
  participantName,
  modelName,
  allComplete,
  hasFailed,
  winnerDeclared,
  waitingForLaunch,
  isExecutionRunning,
}: VideoPanelProps) => {
  const { t } = useTranslation('liveRace');

  if (!streamUrl) {
    return (
      <div className="videoPanel" data-testid="video-panel">
        <div className="transitionScreen" data-testid="transition-screen">
          {waitingForLaunch ? (
            <StatusIndicator type="pending">{t('videoPanel.waitingForLaunch')}</StatusIndicator>
          ) : winnerDeclared ? (
            <Box variant="h2" color="inherit">
              <span role="img" aria-label="trophy">
                🏆
              </span>{' '}
              {t('videoPanel.raceComplete')}
            </Box>
          ) : allComplete ? (
            <>
              <Box variant="h2" color="inherit">
                <span role="img" aria-label="checkered flag">
                  🏁
                </span>{' '}
                {t('videoPanel.allComplete')}
              </Box>
              <Box variant="small" color="inherit">
                {hasFailed ? t('videoPanel.declareOrRetry') : t('videoPanel.declareWinnerPrompt')}
              </Box>
            </>
          ) : (
            <>
              <Box variant="h2" color="inherit">
                {t('videoPanel.upNext')}
              </Box>
              <Box color="inherit">
                {participantName} — {modelName}
              </Box>
              {isExecutionRunning && (
                <Box variant="small" color="inherit">
                  {t('videoPanel.preparingEvaluation')}
                </Box>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="videoPanel" data-testid="video-panel">
      <VideoStreamPlayer key={streamUrl} src={streamUrl} />
    </div>
  );
};

export default VideoPanel;
