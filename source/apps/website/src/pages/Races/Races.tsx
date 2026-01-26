// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { useListLeaderboardsQuery } from '#services/deepRacer/leaderboardsApi.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import RacesDisplay from './components/RacesDisplay';

const Races = () => {
  const { t } = useTranslation('races');
  const navigate = useNavigate();
  const [canManageRaces, setCanManageRaces] = useState(false);
  const { data: leaderboards = [], isLoading } = useListLeaderboardsQuery();

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, []);

  const openLeaderboards = leaderboards.filter((item) => item.closeTime > new Date());
  const closedLeaderboards = leaderboards.filter((item) => item.closeTime <= new Date());
  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            canManageRaces ? (
              <Button variant="primary" onClick={() => navigate(getPath(PageId.CREATE_RACE))}>
                {t('createRace')}
              </Button>
            ) : null
          }
        >
          {t('welcome')}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <RacesDisplay leaderboards={openLeaderboards} isClosed={false} isLoading={isLoading} />
        <RacesDisplay leaderboards={closedLeaderboards} isClosed={true} isLoading={isLoading} />
      </SpaceBetween>
    </ContentLayout>
  );
};

export default Races;
