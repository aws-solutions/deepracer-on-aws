// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import { Leaderboard } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import RaceDetailsColumn from './components/RaceDetailsColumn';
import RaceRulesColumn from './components/RaceRulesColumn';
import RaceTrackColumn from './components/RaceTrackColumn';

interface RaceOverviewProps {
  leaderboard: Leaderboard;
}

const RaceOverview = ({ leaderboard }: RaceOverviewProps) => {
  const { t } = useTranslation('raceDetails');

  return (
    <Container header={<Box variant="h2">{t('header')}</Box>}>
      <ColumnLayout columns={3} variant="text-grid">
        <RaceDetailsColumn leaderboard={leaderboard} />
        <RaceTrackColumn trackConfig={leaderboard.trackConfig} />
        <RaceRulesColumn leaderboard={leaderboard} />
      </ColumnLayout>
    </Container>
  );
};

export default RaceOverview;
