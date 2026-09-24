// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListLeaderboardsQuery } from '#services/deepRacer/leaderboardsApi.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';

import RacesDisplay from './components/RacesDisplay';

const Races = ({ __forceFacilitator }: { __forceFacilitator?: boolean } = {}) => {
  const { t } = useTranslation('races');
  const [canManageRaces, setCanManageRaces] = useState(false);
  const { data: leaderboards = [], isLoading } = useListLeaderboardsQuery();

  useEffect(() => {
    if (__forceFacilitator) {
      setCanManageRaces(true);
      return;
    }
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, [__forceFacilitator]);

  const now = new Date();
  // Physical-race leaderboards belong to an Event (eventId is set) and are managed
  // through the Events/Timekeeping pages — exclude them from the community races view.
  const communityLeaderboards = leaderboards.filter((item) => !item.eventId);
  const isActive = (item: (typeof leaderboards)[0]) =>
    item.closeTime > now || (item.isLive && item.liveEventStatus !== 'COMPLETED');
  const activeLeaderboards = communityLeaderboards.filter(isActive);
  const closedLeaderboards = communityLeaderboards.filter((item) => !isActive(item));
  return (
    <ContentLayout header={<Header variant="h1">{t('welcome')}</Header>}>
      <SpaceBetween size="l">
        <RacesDisplay
          leaderboards={activeLeaderboards}
          isClosed={false}
          isLoading={isLoading}
          canManageRaces={canManageRaces}
          title={t('openRaces')}
        />
        <RacesDisplay
          leaderboards={closedLeaderboards}
          isClosed={true}
          isLoading={isLoading}
          canManageRaces={canManageRaces}
        />
      </SpaceBetween>
    </ContentLayout>
  );
};

export default Races;
