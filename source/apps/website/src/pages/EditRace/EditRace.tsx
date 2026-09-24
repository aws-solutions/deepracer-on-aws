// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import CreateRace, { CreateRaceFormValues } from '#pages/CreateRace/CreateRace.js';
import { DEFAULT_MAX_RESETS } from '#pages/CreateRace/validation.js';
import { isActiveRace } from '#pages/RaceDetails/raceDetailsHelpers.js';
import { useGetLeaderboardQuery, useListLiveQueueItemsQuery } from '#services/deepRacer/leaderboardsApi.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';

const EditRace = () => {
  const { leaderboardId = '' } = useParams();
  const { t } = useTranslation('createRace');
  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    isUninitialized: isGetLeaderboardUninitialized,
  } = useGetLeaderboardQuery({ leaderboardId });

  const { data: queueData } = useListLiveQueueItemsQuery(
    { leaderboardId },
    { skip: !leaderboardId, refetchOnMountOrArgChange: true },
  );

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminCheckLoading, setIsAdminCheckLoading] = useState(true);
  useEffect(() => {
    void checkUserGroupMembership([UserGroups.ADMIN])
      .then(setIsAdmin)
      .finally(() => setIsAdminCheckLoading(false));
  }, []);

  if (isLeaderboardLoading || isGetLeaderboardUninitialized || isAdminCheckLoading) {
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
    startDate: `${leaderboard.openTime.getFullYear()}-${String(leaderboard.openTime.getMonth() + 1).padStart(2, '0')}-${String(leaderboard.openTime.getDate()).padStart(2, '0')}`,
    endDate: `${leaderboard.closeTime.getFullYear()}-${String(leaderboard.closeTime.getMonth() + 1).padStart(2, '0')}-${String(leaderboard.closeTime.getDate()).padStart(2, '0')}`,
    startTime: `${String(leaderboard.openTime.getHours()).padStart(2, '0')}:${String(leaderboard.openTime.getMinutes()).padStart(2, '0')}`,
    endTime: `${String(leaderboard.closeTime.getHours()).padStart(2, '0')}:${String(leaderboard.closeTime.getMinutes()).padStart(2, '0')}`,
    track: leaderboard.trackConfig,
    desc: leaderboard.description || '',
    ranking: leaderboard.timingMethod,
    minLap: leaderboard.submissionTerminationConditions.minimumLaps.toString(),
    maxLap: leaderboard.submissionTerminationConditions.maximumLaps.toString(),
    offTrackPenalty: leaderboard.resettingBehaviorConfig.offTrackPenaltySeconds?.toString() || '1',
    collisionPenalty: leaderboard.resettingBehaviorConfig.collisionPenaltySeconds?.toString() || '1',
    maxSubmissionsPerUser: leaderboard.maxSubmissionsPerUser,
    objectAvoidanceConfig: {
      numberOfObjects: leaderboard.objectAvoidanceConfig?.numberOfObjects || 2,
      objectPositions: leaderboard.objectAvoidanceConfig?.objectPositions,
    },
    randomizeObstacles: !leaderboard.objectAvoidanceConfig?.objectPositions?.length,
    isLive: leaderboard.isLive ?? false,
    liveEventDate: leaderboard.liveEventTime
      ? `${leaderboard.liveEventTime.getFullYear()}-${String(leaderboard.liveEventTime.getMonth() + 1).padStart(2, '0')}-${String(leaderboard.liveEventTime.getDate()).padStart(2, '0')}`
      : '',
    liveEventTime: leaderboard.liveEventTime
      ? `${String(leaderboard.liveEventTime.getHours()).padStart(2, '0')}:${String(leaderboard.liveEventTime.getMinutes()).padStart(2, '0')}`
      : '',
    maxResets: leaderboard.maxResets ?? DEFAULT_MAX_RESETS,
  };

  const isLive = leaderboard.isLive ?? false;
  const isConfigLocked =
    isLive && (queueData?.items ?? []).some((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS');
  // An admin editing an already-open community race may only change end time and max
  // submissions per user (enforced server-side by EditLeaderboard's active-race
  // allowlist) — lock every other field, including the ones isConfigLocked doesn't cover.
  const isActiveRaceAdminEdit = isActiveRace(leaderboard) && isAdmin;

  return (
    <CreateRace
      initialFormValues={initialRaceFormValues}
      leaderboardId={leaderboardId}
      isConfigLocked={isConfigLocked || isActiveRaceAdminEdit}
      isActiveRaceAdminEdit={isActiveRaceAdminEdit}
      originalLeaderboard={leaderboard}
    />
  );
};

export default EditRace;
