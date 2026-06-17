// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table, { TableProps } from '@cloudscape-design/components/table';
import type { TimingMethod } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

export interface RankingEntry {
  rank: number;
  participantName: string;
  modelName: string;
  bestLapTime: number | null;
  submissionId: string;
  avatar: object;
}

interface LeaderboardPanelProps {
  rankings: RankingEntry[];
  timingMethod?: TimingMethod;
}

/**
 * Compact leaderboard table for the live race spectator view.
 * Receives the full rankings array and replaces on each LEADERBOARD_UPDATED event.
 */
const LeaderboardPanel = ({ rankings, timingMethod }: LeaderboardPanelProps) => {
  const { t } = useTranslation('liveRace');

  const columnDefinitions: TableProps.ColumnDefinition<RankingEntry>[] = useMemo(
    () => [
      {
        id: 'rank',
        header: t('leaderboardPanel.rank'),
        cell: (e) => e.rank,
        width: 60,
      },
      {
        id: 'participant',
        header: t('leaderboardPanel.participant'),
        cell: (e) => (
          <div>
            <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.participantName}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-text-status-inactive)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {e.modelName}
            </div>
          </div>
        ),
      },
      {
        id: 'bestLapTime',
        header: t(
          `leaderboardPanel.${timingMethod === 'TOTAL_TIME' ? 'totalTime' : timingMethod === 'AVG_LAP_TIME' ? 'avgLapTime' : 'bestLapTime'}`,
        ),
        cell: (e) => (e.bestLapTime != null ? millisToMinutesAndSeconds(e.bestLapTime) : '—'),
        width: 120,
      },
    ],
    [t, timingMethod],
  );

  return (
    <Container fitHeight header={<Header counter={`(${rankings.length})`}>{t('leaderboardPanel.header')}</Header>}>
      <div style={{ overflowY: 'auto', height: '100%' }}>
        <Table
          items={rankings}
          columnDefinitions={columnDefinitions}
          trackBy="submissionId"
          variant="embedded"
          empty={
            <Box textAlign="center" padding="l">
              {t('leaderboardPanel.empty')}
            </Box>
          }
        />
      </div>
    </Container>
  );
};

export default LeaderboardPanel;
