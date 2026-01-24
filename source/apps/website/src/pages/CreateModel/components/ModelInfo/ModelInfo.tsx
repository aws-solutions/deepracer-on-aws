// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import { RaceType, TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { Control, UseFormResetField, UseFormSetValue, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';

import rlDiagram from '#assets/images/rlDiagram.png';
import InputField from '#components/FormFields/InputField';
import RadioGroupField from '#components/FormFields/RadioGroupField';
import TextAreaField from '#components/FormFields/TextareaField';
import TilesField from '#components/FormFields/TilesField';
import {
  BASIC_REWARD_FUNCTION,
  DEFAULT_OA_CONFIG,
  OBJECT_AVOIDANCE_REWARD_FUNCTION,
} from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { getTrackById } from '#utils/trackUtils';

import ObjectAvoidanceConfig from './components/ObjectAvoidanceConfig';
import { SortByValue } from './constants';
import { getTrackTiles } from './utils';
import './styles.css';

interface ModelInfoProps {
  control: Control<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
  resetField: UseFormResetField<CreateModelFormValues>;
}

const ModelInfo = ({ control, resetField, setValue }: ModelInfoProps) => {
  const { t } = useTranslation('createModel');

  const raceType = useWatch({ control, name: 'trainingConfig.raceType' });
  const trackId = useWatch({ control, name: 'trainingConfig.trackConfig.trackId' });

  const SORT_BY_OPTIONS: SelectProps.Option[] = [
    { label: t('modelInfo.trackSelectionSection.lengthShortestToLongest'), value: SortByValue.LENGTH_SHORTEST },
    { label: t('modelInfo.trackSelectionSection.lengthLongestToShortest'), value: SortByValue.LENGTH_LONGEST },
    { label: t('modelInfo.trackSelectionSection.difficultyMostToLeast'), value: SortByValue.DIFFICULTY_MOST },
    { label: t('modelInfo.trackSelectionSection.difficultyLeastToMost'), value: SortByValue.DIFFICULTY_LEAST },
  ];

  const [trackFilteringText, setTrackFilteringText] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState<SelectProps.Option>(SORT_BY_OPTIONS[0]);

  const selectedTrack = getTrackById(trackId);
  const trackTiles = getTrackTiles(selectedSortBy.value as SortByValue, trackFilteringText);

  return (
    <SpaceBetween direction="vertical" size="l">
      <Trans t={t}>
        <Container header={<Header>{t('modelInfo.overviewSection.header')}</Header>}>
          <Grid
            gridDefinition={[{ colspan: { xs: 7, xxs: 7, default: 12 } }, { colspan: { xs: 5, xxs: 5, default: 12 } }]}
          >
            <Box>
              <Box variant="p">{t('modelInfo.overviewSection.overviewDescription1')}</Box>
              <br />
              <Box variant="p">{t('modelInfo.overviewSection.overviewDescription2')}</Box>
              <br />
              <Box variant="p">{t('modelInfo.overviewSection.overviewDescription3')}</Box>
            </Box>
            <Box>
              <img src={rlDiagram} width="100%" alt={t('modelInfo.overviewSection.rlDiagramAlt')} />
            </Box>
          </Grid>
        </Container>
      </Trans>
      <Container header={<Header>{t('modelInfo.trainingDetailsSection.header')}</Header>}>
        <SpaceBetween size="l">
          <InputField
            control={control}
            constraintText={<Trans t={t}>{t('modelInfo.trainingDetailsSection.modelNameContraintText')}</Trans>}
            label={t('modelInfo.trainingDetailsSection.modelNameLabel')}
            name="modelName"
            placeholder={t('modelInfo.trainingDetailsSection.modelNamePlaceholder')}
          />
          <TextAreaField
            control={control}
            constraintText={t('modelInfo.trainingDetailsSection.modelDescriptionHint')}
            label={<Trans t={t}>{t('modelInfo.trainingDetailsSection.modelDescriptionLabel')}</Trans>}
            name="description"
            placeholder={t('modelInfo.trainingDetailsSection.modelDescriptionPlaceholder')}
          />
        </SpaceBetween>
      </Container>
      <Container header={<Header>{t('modelInfo.trainingDetailsSection.raceType')}</Header>}>
        <TilesField
          control={control}
          columns={2}
          label={t('modelInfo.trainingDetailsSection.chooseARaceType')}
          name="trainingConfig.raceType"
          items={[
            {
              label: t('modelInfo.trainingDetailsSection.timeTrialLabel'),
              description: t('modelInfo.trainingDetailsSection.timeTrialDescription'),
              value: RaceType.TIME_TRIAL,
            },
            {
              label: t('modelInfo.trainingDetailsSection.objectAvoidanceLabel'),
              description: t('modelInfo.trainingDetailsSection.objectAvoidanceDescription'),
              value: RaceType.OBJECT_AVOIDANCE,
            },
          ]}
          onChange={({ detail }) => {
            if (detail.value === RaceType.OBJECT_AVOIDANCE) {
              setValue('metadata.rewardFunction', OBJECT_AVOIDANCE_REWARD_FUNCTION);
              setValue('trainingConfig.objectAvoidanceConfig', DEFAULT_OA_CONFIG);
            } else {
              setValue('metadata.rewardFunction', BASIC_REWARD_FUNCTION);
              resetField('trainingConfig.objectAvoidanceConfig');
            }
          }}
        />
        {raceType === RaceType.OBJECT_AVOIDANCE && <ObjectAvoidanceConfig control={control} />}
      </Container>
      <Container
        header={
          <Header
            description={t('modelInfo.trackSelectionSection.description')}
            counter={t('modelInfo.trackSelectionSection.trackItemsCount', { count: trackTiles.length })}
          >
            {t('modelInfo.trackSelectionSection.header')}
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="m">
          <Box>
            <ColumnLayout columns={2}>
              <Box margin={{ top: 'xl' }}>
                <TextFilter
                  filteringText={trackFilteringText}
                  filteringPlaceholder={t('modelInfo.trackSelectionSection.findTrackLabel')}
                  filteringAriaLabel={t('modelInfo.trackSelectionSection.findTrackAriaLabel')}
                  onChange={({ detail }) => {
                    setTrackFilteringText(detail.filteringText);
                  }}
                />
              </Box>
              <SpaceBetween direction="vertical" size="xxs" className="trackSortByBox">
                <Box variant="strong">{t('modelInfo.trackSelectionSection.sortByLabel')}</Box>
                <Select
                  selectedOption={selectedSortBy}
                  onChange={({ detail }) => {
                    setSelectedSortBy(detail.selectedOption);
                  }}
                  options={SORT_BY_OPTIONS}
                />
              </SpaceBetween>
            </ColumnLayout>
          </Box>
          <TilesField
            control={control}
            className="disable-scrollbars trackSelectionTiles"
            columns={3}
            name="trainingConfig.trackConfig.trackId"
            items={trackTiles}
            onChange={(event) => {
              setValue(
                'trainingConfig.trackConfig.trackDirection',
                getTrackById(event.detail.value as TrackId).defaultDirection,
              );
            }}
          />
          <RadioGroupField
            control={control}
            name="trainingConfig.trackConfig.trackDirection"
            label={t('modelInfo.trackSelectionSection.trackDirectionLabel')}
            description={t('modelInfo.trackSelectionSection.trackDirectionDescription')}
            items={[
              {
                label: t('modelInfo.trackSelectionSection.counterClockwise'),
                value: TrackDirection.COUNTER_CLOCKWISE,
                disabled: !selectedTrack.enabledDirections.includes(TrackDirection.COUNTER_CLOCKWISE),
              },
              {
                label: t('modelInfo.trackSelectionSection.clockwise'),
                value: TrackDirection.CLOCKWISE,
                disabled: !selectedTrack.enabledDirections.includes(TrackDirection.CLOCKWISE),
              },
            ]}
          />
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};

export default ModelInfo;
