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
import { ModelStatus } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import RaceOverview from '#components/RaceOverview';
import { PageId } from '#constants/pages.js';
import { useGetLeaderboardQuery } from '#services/deepRacer/leaderboardsApi.js';
import { useListModelsQuery } from '#services/deepRacer/modelsApi.js';
import { useCreateSubmissionMutation } from '#services/deepRacer/submissionsApi.js';
import { getPath } from '#utils/pageUtils.js';

const EnterRace = () => {
  const { leaderboardId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('enterRace');
  const [selectedModel, setSelectedModel] = useState<null | SelectProps.Option>(null);

  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    isUninitialized: isGetLeaderboardUninitialized,
  } = useGetLeaderboardQuery({ leaderboardId });
  const { data: models = [], isLoading: isListModelsLoading } = useListModelsQuery();
  const [createSubmission, { isLoading: isCreateSubmissionLoading }] = useCreateSubmissionMutation();

  const eligibleModels = models.filter((item) => item.status === ModelStatus.READY);

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
    <ContentLayout header={<Header variant="h1">{t('enterRace')}</Header>}>
      <SpaceBetween direction="vertical" size="l">
        <RaceOverview leaderboard={leaderboard} />
        <Container header={<Header variant="h2">{t('chooseModel')}</Header>}>
          <FormField description={t('description')} label={t('selection')}>
            <Select
              empty={
                <>
                  {t('noEligibleModels')}{' '}
                  <Button onClick={() => navigate(getPath(PageId.CREATE_MODEL))}>{t('createModel')}</Button>
                </>
              }
              loadingText={t('retrievingModels')}
              onChange={({ detail }) => {
                setSelectedModel(detail.selectedOption);
              }}
              options={eligibleModels.map((model) => ({
                label: model.name,
                value: model.modelId,
                description: model.description,
              }))}
              placeholder={t('chooseAModel')}
              statusType={isListModelsLoading ? 'loading' : 'finished'}
              selectedOption={selectedModel}
            />
          </FormField>
        </Container>
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => navigate(getPath(PageId.RACE_DETAILS, { leaderboardId }))}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              loading={isCreateSubmissionLoading}
              onClick={async () => {
                await createSubmission({
                  leaderboardId,
                  modelId: selectedModel?.value || '',
                });
                navigate(getPath(PageId.RACE_DETAILS, { leaderboardId }));
              }}
              disabled={!selectedModel}
              disabledReason={t('noSelectedModels')}
            >
              {t('enterRace')}
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default EnterRace;
