// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import { Leaderboard, LeaderboardDefinition } from '@deepracer-indy/typescript-client';
import { Dispatch, SetStateAction } from 'react';

import RaceDetailsColumn from '#components/RaceOverview/components/RaceDetailsColumn.js';
import RaceRulesColumn from '#components/RaceOverview/components/RaceRulesColumn.js';
import RaceTrackColumn from '#components/RaceOverview/components/RaceTrackColumn.js';

const ReviewRaceDetails = ({
  leaderboardDef,
  setActiveStepIndex,
}: {
  leaderboardDef: LeaderboardDefinition;
  setActiveStepIndex: Dispatch<SetStateAction<number>>;
}) => {
  const newLeaderboard: Leaderboard = {
    name: leaderboardDef.name,
    openTime: leaderboardDef.openTime,
    closeTime: leaderboardDef.closeTime,
    trackConfig: leaderboardDef.trackConfig,
    raceType: leaderboardDef.raceType,
    maxSubmissionsPerUser: leaderboardDef.maxSubmissionsPerUser,
    resettingBehaviorConfig: leaderboardDef.resettingBehaviorConfig,
    submissionTerminationConditions: leaderboardDef.submissionTerminationConditions,
    timingMethod: leaderboardDef.timingMethod,
    leaderboardId: '',
    participantCount: 0,
    description: leaderboardDef.description,
  };
  return (
    <Container
      header={
        <Header variant="h2" actions={<Button onClick={() => setActiveStepIndex(0)}>Edit</Button>}>
          {leaderboardDef.name}
        </Header>
      }
    >
      <ColumnLayout columns={3} variant="text-grid">
        <RaceDetailsColumn leaderboard={newLeaderboard} />
        <RaceTrackColumn trackConfig={newLeaderboard.trackConfig} />
        <RaceRulesColumn leaderboard={newLeaderboard} />
      </ColumnLayout>
    </Container>
  );
};

export default ReviewRaceDetails;
