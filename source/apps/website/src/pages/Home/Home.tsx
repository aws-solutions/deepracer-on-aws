// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import '#pages/Home/styles.css';

import HoursPieChart from '#components/HoursPieChart/HoursPieChart';
import { PageId } from '#constants/pages';
import { useListModelsQuery } from '#services/deepRacer/modelsApi';
import { useGetProfileQuery } from '#services/deepRacer/profileApi';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { getPath } from '#utils/pageUtils';

const Home = () => {
  const { t } = useTranslation('home');
  const [canManageRaces, setCanManageRaces] = useState(false);
  const navigate = useNavigate();

  const { data: profile, isLoading: isProfileLoading } = useGetProfileQuery();
  const { data: models } = useListModelsQuery();

  const trainedModelCount = models?.length || 0;
  const allowedModelCount = profile?.maxModelCount || 0;
  const isUnlimitedModels = allowedModelCount === -1;

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, []);

  return (
    <ContentLayout header={<Header variant="h1">{t('header')}</Header>}>
      <Grid gridDefinition={[{ colspan: { default: 6, s: 4 } }, { colspan: { default: 6, s: 4 } }]}>
        <SpaceBetween size="m">
          <Container header={<Header variant="h2">{t('fundamentals.header')}</Header>}>
            <div className="fundamentalsContainer">
              <SpaceBetween size="m">
                <Box>{t('fundamentals.description')}</Box>
                <Button onClick={() => navigate(getPath(PageId.GET_STARTED))} variant="primary">
                  {t('fundamentals.button')}
                </Button>
              </SpaceBetween>
            </div>
          </Container>
          {canManageRaces ? (
            <Container header={<Header variant="h2">{t('communityRaces.header')}</Header>}>
              <SpaceBetween size="m">
                <Box>{t('communityRaces.description')}</Box>
                <Button onClick={() => navigate(getPath(PageId.RACES))} variant="primary">
                  {t('communityRaces.button')}
                </Button>
              </SpaceBetween>
            </Container>
          ) : null}
        </SpaceBetween>
        <Container header={<Header variant="h2">{t('models.header')}</Header>}>
          <SpaceBetween size="m">
            <Box>{t('models.description')}</Box>
            <Button onClick={() => navigate(getPath(PageId.MODELS))} variant="primary">
              {t('models.button')}
            </Button>
            {isProfileLoading ? (
              <div className="centerPieChart">
                <Box textAlign="center" color="text-status-inactive">
                  {t('models.loadingChart')}
                </Box>
              </div>
            ) : profile ? (
              <div>
                <div className="centerPieChart">
                  <HoursPieChart />
                </div>
                <SpaceBetween size="xxxs">
                  <Box color="text-status-inactive" textAlign="center">
                    {t('models.modelCountHeader')}
                  </Box>
                  <Box textAlign="center">
                    {isUnlimitedModels
                      ? `${trainedModelCount} ${trainedModelCount === 1 ? 'model' : 'models'}`
                      : t('models.modelCount', { trainedCount: trainedModelCount, allowedCount: allowedModelCount })}
                  </Box>
                </SpaceBetween>
              </div>
            ) : null}
          </SpaceBetween>
        </Container>
      </Grid>
    </ContentLayout>
  );
};

export default Home;
