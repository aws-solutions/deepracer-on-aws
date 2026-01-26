// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { PersonalRanking, Submission } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import AvatarDisplay from '#components/Avatar/AvatarDisplay';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

import { getBestSubmission } from './utils';

interface UserRaceStatsProps {
  submissions?: Submission[];
  personalRanking?: PersonalRanking;
}

const UserRaceStats = ({ personalRanking, submissions }: UserRaceStatsProps) => {
  const { t } = useTranslation('raceDetails');

  const { data: profile } = useGetProfileQuery();

  const bestSubmission = useMemo(
    () => (personalRanking ? personalRanking : getBestSubmission(submissions)),
    [personalRanking, submissions],
  );

  return (
    <Container>
      <Box textAlign="center">
        <SpaceBetween size="xxl" direction="vertical">
          <div>
            <AvatarDisplay avatarConfig={profile?.avatar} />
            <Box variant="h1" margin={{ top: 'm', bottom: 'xxs' }}>
              {profile?.alias || '--'}
            </Box>
          </div>
          <div>
            <Box variant="h3">{t('yourFastestTime')}</Box>
            <Box variant="awsui-value-large" tagOverride="h3" margin="n" padding={{ bottom: 'xxs' }}>
              {millisToMinutesAndSeconds(bestSubmission?.rankingScore)}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label" tagOverride="label">
              {t('fastestModelSubmitted')}
            </Box>
            <Box padding={{ bottom: 'l' }}>{bestSubmission?.modelName ?? '--'}</Box>
          </div>
        </SpaceBetween>
      </Box>
    </Container>
  );
};

export default UserRaceStats;
