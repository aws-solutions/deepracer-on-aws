// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { ModelStatus, UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useListLeaderboardsQuery } from '#services/deepRacer/leaderboardsApi';
import { useGetModelQuery } from '#services/deepRacer/modelsApi';
import { useCreateSubmissionMutation } from '#services/deepRacer/submissionsApi';
import { displaySuccessNotification } from '#store/notifications/notificationsSlice';
import { checkUserGroupMembership } from '#utils/authUtils';
import { getPath } from '#utils/pageUtils';

const SubmitModelToRace = () => {
  const { modelId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('submitModelToRace');
  const { t: tCommon } = useTranslation('common', { keyPrefix: 'modelStatus' });
  const [selectedRace, setSelectedRace] = useState<null | SelectProps.Option>(null);
  const [canManageRaces, setCanManageRaces] = useState(false);

  const {
    data: model,
    isLoading: isModelLoading,
    isUninitialized: isGetModelUninitialized,
  } = useGetModelQuery({ modelId });

  const { data: leaderboards = [], isLoading: isListLeaderboardsLoading } = useListLeaderboardsQuery();
  const [createSubmission, { isLoading: isCreateSubmissionLoading }] = useCreateSubmissionMutation();

  useEffect(() => {
    const checkRaceManagementPermissions = async () => {
      setCanManageRaces(await checkUserGroupMembership([UserGroups.RACE_FACILITATORS, UserGroups.ADMIN]));
    };

    void checkRaceManagementPermissions();
  }, []);

  // Filter to only open races
  const currentTime = new Date();
  const openRaces = leaderboards.filter((race) => currentTime >= race.openTime && currentTime < race.closeTime);

  if (isGetModelUninitialized || isModelLoading) {
    return <Spinner data-testid="model-loading-spinner" />;
  }

  if (!model) {
    return (
      <Box textAlign="center" variant="pre">
        {t('modelDoesNotExist')}
      </Box>
    );
  }

  if (model.status !== ModelStatus.READY) {
    return (
      <Box textAlign="center" variant="pre">
        {t('modelNotReady')}
      </Box>
    );
  }

  return (
    <ContentLayout header={<Header variant="h1">{t('submitModelToRace')}</Header>}>
      <SpaceBetween direction="vertical" size="l">
        {/* Model Overview */}
        <Container header={<Header variant="h2">{t('modelDetails')}</Header>}>
          <SpaceBetween direction="vertical" size="s">
            <Box variant="h3">{model.name}</Box>
            <SpaceBetween direction="horizontal" size="s" alignItems="center">
              <Box variant="span">Status:</Box>
              <StatusIndicator type={'success'}>{tCommon(model.status)}</StatusIndicator>
            </SpaceBetween>
            {model.description && <Box variant="p">{model.description}</Box>}
          </SpaceBetween>
        </Container>

        {/* Race Selection */}
        <Container header={<Header variant="h2">{t('chooseRace')}</Header>}>
          <FormField description={t('raceDescription')} label={t('raceSelection')}>
            <Select
              empty={
                <>
                  {t('noOpenRaces')}{' '}
                  {canManageRaces && (
                    <Button onClick={() => navigate(getPath(PageId.CREATE_RACE))}>{t('createRace')}</Button>
                  )}
                </>
              }
              loadingText={t('retrievingRaces')}
              onChange={({ detail }) => {
                setSelectedRace(detail.selectedOption);
              }}
              options={openRaces.map((race) => ({
                label: race.name,
                value: race.leaderboardId,
                description: `${t('closesOn')} ${race.closeTime.toLocaleDateString()}`,
              }))}
              placeholder={t('chooseARace')}
              statusType={isListLeaderboardsLoading ? 'loading' : 'finished'}
              selectedOption={selectedRace}
            />
          </FormField>
        </Container>

        {/* Action Buttons */}
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => navigate(getPath(PageId.MODEL_DETAILS, { modelId }))}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              loading={isCreateSubmissionLoading}
              onClick={async () => {
                await createSubmission({
                  leaderboardId: selectedRace?.value || '',
                  modelId,
                })
                  .unwrap()
                  .then(() => {
                    dispatch(
                      displaySuccessNotification({
                        content: t('submitModelSuccess', {
                          modelName: model.name,
                          raceName: selectedRace?.label,
                        }),
                      }),
                    );
                    navigate(getPath(PageId.MODEL_DETAILS, { modelId }));
                  });
              }}
              disabled={!selectedRace}
              disabledReason={t('noSelectedRace')}
            >
              {t('submitToRace')}
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default SubmitModelToRace;
