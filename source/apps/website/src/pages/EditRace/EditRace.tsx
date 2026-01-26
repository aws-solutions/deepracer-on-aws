// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import CreateRace, { CreateRaceFormValues } from '#pages/CreateRace/CreateRace.js';
import { useGetLeaderboardQuery } from '#services/deepRacer/leaderboardsApi.js';

const EditRace = () => {
  const { leaderboardId = '' } = useParams();
  const { t } = useTranslation('createRace');
  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    isUninitialized: isGetLeaderboardUninitialized,
  } = useGetLeaderboardQuery({ leaderboardId });
  if (isLeaderboardLoading || isGetLeaderboardUninitialized) {
    return <Spinner />;
  }

  if (!leaderboard) {
    return (
      <Box textAlign="center" variant="pre">
        {t('raceDoesNotExist')}
      </Box>
    );
  }
  const initialRaceFormValues: CreateRaceFormValues = {
    raceType: leaderboard.raceType,
    raceName: leaderboard.name,
    startDate: leaderboard.openTime.toISOString().split('T')[0],
    endDate: leaderboard.closeTime.toISOString().split('T')[0],
    startTime: leaderboard.openTime.toISOString().split('T')[1],
    endTime: leaderboard.closeTime.toISOString().split('T')[1],
    track: leaderboard.trackConfig,
    desc: leaderboard.description || '',
    ranking: leaderboard.timingMethod,
    minLap: leaderboard.submissionTerminationConditions.minimumLaps.toString(),
    offTrackPenalty: leaderboard.resettingBehaviorConfig.offTrackPenaltySeconds?.toString() || '1',
    collisionPenalty: leaderboard.resettingBehaviorConfig.collisionPenaltySeconds?.toString() || '1',
    maxSubmissionsPerUser: leaderboard.maxSubmissionsPerUser,
    objectAvoidanceConfig: {
      numberOfObjects: leaderboard.objectAvoidanceConfig?.numberOfObjects || 2,
      objectPositions: leaderboard.objectAvoidanceConfig?.objectPositions,
    },
    randomizeObstacles: !leaderboard.objectAvoidanceConfig?.objectPositions?.length,
  };
  return <CreateRace initialFormValues={initialRaceFormValues} leaderboardId={leaderboardId} />;
};

export default EditRace;
