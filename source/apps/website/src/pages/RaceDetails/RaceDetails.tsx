// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Tabs from '@cloudscape-design/components/tabs';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import RaceOverview from '#components/RaceOverview';
import { PageId } from '#constants/pages.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useDeleteLeaderboardMutation, useGetLeaderboardQuery } from '#services/deepRacer/leaderboardsApi.js';
import { useGetRankingQuery, useListRankingsQuery } from '#services/deepRacer/rankingsApi.js';
import { useListSubmissionsQuery } from '#services/deepRacer/submissionsApi.js';
import { displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils.js';

import RaceLeaderboardTable from './components/RaceLeaderboardTable';
import SubmissionsTable from './components/SubmissionsTable';
import UserRaceStats from './components/UserRaceStats';

const RaceDetails = () => {
  const { t } = useTranslation('raceDetails');
  const { leaderboardId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: rankings = [] } = useListRankingsQuery({ leaderboardId });
  const { data: personalRanking } = useGetRankingQuery({ leaderboardId });
  const { data: submissions = [] } = useListSubmissionsQuery({ leaderboardId });
  const [deleteLeaderboard] = useDeleteLeaderboardMutation();
  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    isUninitialized: isGetLeaderboardUninitialized,
  } = useGetLeaderboardQuery({ leaderboardId });
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [canManageRaces, setCanManageRaces] = useState(false);

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, []);

  if (isGetLeaderboardUninitialized || isLeaderboardLoading) {
    return <Spinner />;
  }

  if (!leaderboard) {
    return (
      <Box textAlign="center" variant="pre">
        {t('raceDoesNotExist')}
      </Box>
    );
  }

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              {canManageRaces && (
                <>
                  <Button
                    variant="normal"
                    disabled={new Date() >= leaderboard.openTime && new Date() < leaderboard.closeTime}
                    onClick={() => setDeleteModalVisible(true)}
                    data-testid="btn-delete-race"
                  >
                    {t('deleteRace')}
                  </Button>
                  <Button
                    variant="normal"
                    disabled={new Date() >= leaderboard.openTime}
                    onClick={() => navigate(getPath(PageId.EDIT_RACE, { leaderboardId }))}
                  >
                    {t('editRace')}
                  </Button>
                </>
              )}
              <Button
                variant="primary"
                disabled={new Date() >= leaderboard.closeTime || new Date() < leaderboard.openTime}
                onClick={() => navigate(getPath(PageId.ENTER_RACE, { leaderboardId }))}
              >
                {t('enterRace')}
              </Button>
            </SpaceBetween>
          }
        >
          {leaderboard.name}
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        <RaceOverview leaderboard={leaderboard} />
        <Grid gridDefinition={[{ colspan: { xs: 3, default: 12 } }, { colspan: { xs: 9, default: 12 } }]}>
          <UserRaceStats submissions={submissions} personalRanking={personalRanking} />
          <Tabs
            tabs={[
              {
                label: t('tabs.raceLeaderboard'),
                content: <RaceLeaderboardTable rankings={rankings} leaderboard={leaderboard} />,
                id: 'leaderboard',
              },
              {
                label: `${t('tabs.yourSubmissions')} (${submissions?.length ?? 0})`,
                content: <SubmissionsTable submissions={submissions} leaderboard={leaderboard} />,
                id: 'yourSubmissions',
              },
            ]}
          />
        </Grid>
      </SpaceBetween>
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={() => {
                  setDeleteModalVisible(false);
                }}
                variant="normal"
              >
                {t('submissionsTable.collectionPreferences.cancelLabel')}
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await deleteLeaderboard({ leaderboardId: leaderboardId })
                    .unwrap()
                    .then(() => {
                      dispatch(
                        displaySuccessNotification({
                          content: t('deleteRaceSuccessful'),
                          persistForPageChanges: 1,
                        }),
                        navigate(getPath(PageId.MANAGE_RACES)),
                      );
                    });
                }}
              >
                {t('deleteRace')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('deleteRace')}
      >
        {t('deleteRaceConfirm')}
      </Modal>
    </ContentLayout>
  );
};

export default RaceDetails;
