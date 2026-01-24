// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { RaceType, TimingMethod } from '@deepracer-indy/typescript-client';
import { MutableRefObject, useEffect } from 'react';
import { Control, useFieldArray, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import CheckboxField from '#components/FormFields/CheckboxField/CheckboxField.js';
import DatePickerField from '#components/FormFields/DatePickerField/DatePickerField';
import InputField from '#components/FormFields/InputField/InputField';
import SelectField from '#components/FormFields/SelectField/SelectField';
import TextareaField from '#components/FormFields/TextareaField/TextareaField';
import TilesField from '#components/FormFields/TilesField/TilesField';
import TimeInputField from '#components/FormFields/TimeInputField/TimeInputField';
import TrackSelection from '#components/TrackSelection';
import { DEFAULT_OBJECT_POSITIONS, TRACKS } from '#constants/tracks';
import { isDateRangeInvalid } from '#utils/dateTimeUtils';

import { CreateRaceFormValues } from '../CreateRace';

export interface AddRaceDetailsProps {
  setValue: UseFormSetValue<CreateRaceFormValues>;
  nameRef: MutableRefObject<HTMLDivElement | null>;
  control: Control<CreateRaceFormValues>;
}

const AddRaceDetails = (props: AddRaceDetailsProps) => {
  const { setValue, nameRef, control } = props;
  const { t } = useTranslation('createRace');
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'objectAvoidanceConfig.objectPositions',
  });
  // For validation as user is typing dates
  const [startDate, startTime, endDate, endTime, raceType, objectAvoidanceConfig, randomizeObstacles] = useWatch({
    name: ['startDate', 'startTime', 'endDate', 'endTime', 'raceType', 'objectAvoidanceConfig', 'randomizeObstacles'],
    control,
  });

  useEffect(() => {
    const objectDiff = fields.length - objectAvoidanceConfig.numberOfObjects;
    if (!randomizeObstacles && objectDiff < 0) {
      append(DEFAULT_OBJECT_POSITIONS.slice(fields.length, fields.length - objectDiff));
    }
    if (!randomizeObstacles && objectDiff > 0) {
      remove(Array.from({ length: objectDiff }, (_, index) => fields.length - 1 - index));
    }
  }, [objectAvoidanceConfig.numberOfObjects, randomizeObstacles, fields.length, append, remove]);

  const currentDate = new Date();
  return (
    <SpaceBetween size={'l'} direction="vertical">
      <Container
        header={
          <Header variant="h2" description={t('addRaceDetails.raceDetailsDesc')}>
            {t('addRaceDetails.raceDetails')}
          </Header>
        }
      >
        <SpaceBetween size={'m'} direction="vertical">
          <TilesField
            description={t('addRaceDetails.chooseRaceTypeDesc')}
            label={t('addRaceDetails.chooseRaceType')}
            stretch
            items={[
              {
                label: t('addRaceDetails.timeTrial'),
                description: t('addRaceDetails.timeTrialDesc'),
                value: RaceType.TIME_TRIAL,
              },
              {
                label: t('addRaceDetails.objectAvoidance'),
                description: t('addRaceDetails.objectAvoidanceDesc'),
                value: RaceType.OBJECT_AVOIDANCE,
              },
            ]}
            name="raceType"
            control={control}
          />

          <div ref={nameRef}>
            <InputField
              placeholder="My-race-name"
              type={'text'}
              name="raceName"
              control={control}
              constraintText={t('addRaceDetails.nameOfRacingEventDesc')}
              label={t('addRaceDetails.nameOfRacingEvent')}
              stretch
            />
          </div>
          <div>
            <FormField
              description={t('addRaceDetails.chooseRaceDatesDesc')}
              label={t('addRaceDetails.chooseRaceDates')}
              stretch
            >
              <SpaceBetween direction="horizontal" size={'xxl'}>
                <DatePickerField
                  name="startDate"
                  control={control}
                  placeholder="YYYY/MM/DD"
                  isDateEnabled={(date) => date >= new Date(currentDate.toLocaleDateString())}
                />
                <TimeInputField
                  name="startTime"
                  control={control}
                  format="hh:mm"
                  placeholder="hh:mm"
                  use24Hour
                  invalid={startTime !== '' && new Date(startDate + ' ' + startTime) < currentDate}
                />
              </SpaceBetween>
              <Box margin={{ top: 'xs' }} />
              <SpaceBetween direction="horizontal" size={'xxl'}>
                <DatePickerField
                  name="endDate"
                  control={control}
                  placeholder="YYYY/MM/DD"
                  isDateEnabled={(date) =>
                    date >= new Date(startDate) && date >= new Date(currentDate.toLocaleDateString())
                  }
                  disabled={startDate === ''}
                />
                <TimeInputField
                  name="endTime"
                  control={control}
                  format="hh:mm"
                  placeholder="hh:mm"
                  use24Hour
                  invalid={isDateRangeInvalid({ startDate, startTime, endDate, endTime })}
                  disabled={startDate === ''}
                />
              </SpaceBetween>
            </FormField>
          </div>
        </SpaceBetween>
      </Container>
      <Container
        header={
          <Header variant="h2" description={t('addRaceDetails.competitionTracksDesc')} counter={`(${TRACKS.length})`}>
            {t('addRaceDetails.competitionTracks')}
          </Header>
        }
      >
        <TrackSelection control={control} setValue={setValue} trackConfigFieldName="track" />
        <br />
        <ExpandableSection headerText={t('addRaceDetails.raceCustom')}>
          <SpaceBetween size={'m'} direction="vertical">
            <TextareaField
              label={
                <span>
                  {t('addRaceDetails.raceCustomDesc')}
                  <i>{t('addRaceDetails.optional')}</i>
                </span>
              }
              name="desc"
              control={control}
              placeholder={t('addRaceDetails.placeholder')}
              constraintText={t('addRaceDetails.raceDescriptionConstraintText')}
            />

            <SelectField
              description={t('addRaceDetails.rankingMethodDesc')}
              label={t('addRaceDetails.rankingMethod')}
              control={control}
              name="ranking"
              options={[
                {
                  label: t(`addRaceDetails.${TimingMethod.TOTAL_TIME}`),
                  value: TimingMethod.TOTAL_TIME,
                },
                {
                  label: t(`addRaceDetails.${TimingMethod.AVG_LAP_TIME}`),
                  value: TimingMethod.AVG_LAP_TIME,
                },
                {
                  label: t(`addRaceDetails.${TimingMethod.BEST_LAP_TIME}`),
                  value: TimingMethod.BEST_LAP_TIME,
                },
              ]}
            />

            <SelectField
              description={t('addRaceDetails.minimumLapsDesc')}
              label={t('addRaceDetails.minimumLaps')}
              name="minLap"
              control={control}
              options={[
                { label: '1 lap', value: '1' },
                { label: `2 ${t('addRaceDetails.consecutiveLaps')}`, value: '2' },
                { label: `3 ${t('addRaceDetails.consecutiveLaps')}`, value: '3' },
              ]}
            />

            <SelectField
              description={t('addRaceDetails.offtrackPenaltyDesc')}
              label={t('addRaceDetails.offtrackPenalty')}
              name="offTrackPenalty"
              control={control}
              options={[
                { label: `1 ${t('addRaceDetails.second')}`, value: '1' },
                { label: `2 ${t('addRaceDetails.seconds')}`, value: '2' },
                { label: `3 ${t('addRaceDetails.seconds')}`, value: '3' },
              ]}
            />

            <InputField
              type={'number'}
              name="maxSubmissionsPerUser"
              control={control}
              label={t('addRaceDetails.maxSubmissionsPerUser')}
            />

            {raceType === RaceType.OBJECT_AVOIDANCE && (
              <>
                <SelectField
                  description={t('addRaceDetails.collisionPenaltyDesc')}
                  label={t('addRaceDetails.collisionPenalty')}
                  name="collisionPenalty"
                  control={control}
                  options={[
                    { label: `1 ${t('addRaceDetails.second')}`, value: '1' },
                    { label: `2 ${t('addRaceDetails.seconds')}`, value: '2' },
                    { label: `3 ${t('addRaceDetails.seconds')}`, value: '3' },
                  ]}
                />
                <SelectField
                  description={t('addRaceDetails.numObjectsDesc')}
                  label={t('addRaceDetails.numObjects')}
                  control={control}
                  name="objectAvoidanceConfig.numberOfObjects"
                  options={[
                    { label: '1', value: 1 },
                    { label: '2', value: 2 },
                    { label: '3', value: 3 },
                    { label: '4', value: 4 },
                    { label: '5', value: 5 },
                  ]}
                  type="number"
                />
                <CheckboxField
                  label={t('addRaceDetails.randomizeObstacles')}
                  control={control}
                  name="randomizeObstacles"
                />
                {!randomizeObstacles &&
                  fields.map((item, index) => (
                    <Box key={item.id}>
                      {t('addRaceDetails.obstacle', { number: index + 1 })}
                      <SpaceBetween size="m" direction="horizontal">
                        <SelectField
                          label={t('addRaceDetails.lanePlacement')}
                          control={control}
                          name={`objectAvoidanceConfig.objectPositions.${index}.laneNumber`}
                          options={[
                            { label: t('addRaceDetails.insideLane'), value: -1 },
                            { label: t('addRaceDetails.outsideLane'), value: 1 },
                          ]}
                          type="number"
                        />
                        <FormField>
                          <InputField
                            label={t('addRaceDetails.laneLocation')}
                            type="number"
                            control={control}
                            name={`objectAvoidanceConfig.objectPositions.${index}.trackPercentage`}
                          />
                        </FormField>
                      </SpaceBetween>
                    </Box>
                  ))}
              </>
            )}
          </SpaceBetween>
        </ExpandableSection>
      </Container>
    </SpaceBetween>
  );
};

export default AddRaceDetails;
