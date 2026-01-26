// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import RadioGroup from '@cloudscape-design/components/radio-group';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useState } from 'react';
import { Control, useFieldArray, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import fixedObjectPositionsImage from '#assets/images/fixedObjectPositions.png';
import obstacleBoxImage from '#assets/images/obstacleBox.svg';
import randomizedObjectPositionImage from '#assets/images/randomizedObjectPositions.png';
import InputField from '#components/FormFields/InputField';
import SelectField from '#components/FormFields/SelectField';
import { DEFAULT_OBJECT_POSITIONS } from '#constants/tracks';
import i18n from '#i18n';
import { CreateModelFormValues } from '#pages/CreateModel/types';

const OBSTACLE_LOCATION_OPTIONS = [
  {
    value: 'FIXED',
    label: i18n.t('createModel:modelInfo.objectAvoidanceConfig.fixedLocation'),
    description: i18n.t('createModel:modelInfo.objectAvoidanceConfig.fixedLocationDescription'),
  },
  {
    value: 'RANDOMIZED',
    label: i18n.t('createModel:modelInfo.objectAvoidanceConfig.randomizedLocation'),
    description: i18n.t('createModel:modelInfo.objectAvoidanceConfig.randomizedLocationDescription'),
  },
];

interface ObjectAvoidanceConfigProps {
  control: Control<CreateModelFormValues>;
}

const ObjectAvoidanceConfig = ({ control }: ObjectAvoidanceConfigProps) => {
  const { t } = useTranslation('createModel');
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'trainingConfig.objectAvoidanceConfig.objectPositions',
  });
  const numberOfObjects = useWatch({ control, name: 'trainingConfig.objectAvoidanceConfig.numberOfObjects' });
  const objectPositions = useWatch({ control, name: 'trainingConfig.objectAvoidanceConfig.objectPositions' });
  const [isRandomizedLocation, setIsRandomizedLocation] = useState(!objectPositions?.length);

  useEffect(() => {
    const objectDiff = fields.length - numberOfObjects;
    if (!isRandomizedLocation && fields.length < numberOfObjects) {
      append(DEFAULT_OBJECT_POSITIONS.slice(fields.length, fields.length - objectDiff));
    }
    if (!isRandomizedLocation && fields.length > numberOfObjects) {
      remove(Array.from({ length: objectDiff }, (_, index) => fields.length - 1 - index));
    }
  }, [fields.length, numberOfObjects, isRandomizedLocation, append, remove]);

  return (
    <div>
      <Grid gridDefinition={[{ colspan: { m: 6, xs: 6, xxs: 3 } }, { colspan: { m: 6, xs: 6, xxs: 3 } }]}>
        <SpaceBetween direction="vertical" size="xxl">
          <SpaceBetween direction="vertical" size="s">
            <Box>{t('modelInfo.objectAvoidanceConfig.objectLocationTitle')}</Box>
            <RadioGroup
              onChange={({ detail }) => {
                if (detail.value === OBSTACLE_LOCATION_OPTIONS[1].value) {
                  setIsRandomizedLocation(true);
                  remove();
                } else {
                  setIsRandomizedLocation(false);
                }
              }}
              value={isRandomizedLocation ? OBSTACLE_LOCATION_OPTIONS[1].value : OBSTACLE_LOCATION_OPTIONS[0].value}
              items={OBSTACLE_LOCATION_OPTIONS}
            />
          </SpaceBetween>
          <SelectField
            control={control}
            label={t('modelInfo.objectAvoidanceConfig.numberOfObjectsLabel')}
            description={t('modelInfo.objectAvoidanceConfig.numberOfObjectsDescription')}
            name="trainingConfig.objectAvoidanceConfig.numberOfObjects"
            options={[
              {
                label: '1',
                value: 1,
              },
              {
                label: '2',
                value: 2,
              },
              {
                label: '3',
                value: 3,
              },
              {
                label: '4',
                value: 4,
              },
              {
                label: '5',
                value: 5,
              },
              {
                label: '6',
                value: 6,
              },
            ]}
            type="number"
          />
          <Box float="left">
            <Box padding={{ bottom: 'xs' }} fontSize="body-m">
              {t('modelInfo.objectAvoidanceConfig.objectType')}
              <br></br>
              <img alt={t('modelInfo.objectAvoidanceConfig.boxAlt')} src={obstacleBoxImage} />{' '}
              {t('modelInfo.objectAvoidanceConfig.box')}
            </Box>
          </Box>
        </SpaceBetween>
        <Box>
          <img
            alt={t('modelInfo.objectAvoidanceConfig.objectImageAlt')}
            src={isRandomizedLocation ? randomizedObjectPositionImage : fixedObjectPositionsImage}
          />
        </Box>
      </Grid>
      <Box margin={{ top: 'xxl' }}>
        {fields.map((field, index) => (
          <div key={field.id}>
            <FormField label={t('modelInfo.objectAvoidanceConfig.obstacle', { count: index + 1 })}>
              <ColumnLayout columns={2}>
                <SelectField
                  control={control}
                  label={t('modelInfo.objectAvoidanceConfig.lanePlacement')}
                  name={`trainingConfig.objectAvoidanceConfig.objectPositions.${index}.laneNumber`}
                  options={[
                    {
                      label: i18n.t('createModel:modelInfo.objectAvoidanceConfig.outsideLane'),
                      value: -1,
                    },
                    {
                      label: i18n.t('createModel:modelInfo.objectAvoidanceConfig.insideLane'),
                      value: 1,
                    },
                  ]}
                  type="number"
                />
                <InputField
                  control={control}
                  label={t('modelInfo.objectAvoidanceConfig.trackPercentage')}
                  name={`trainingConfig.objectAvoidanceConfig.objectPositions.${index}.trackPercentage`}
                  type="number"
                  step={0.01}
                />
              </ColumnLayout>
            </FormField>
            <br />
          </div>
        ))}
      </Box>
    </div>
  );
};

export default ObjectAvoidanceConfig;
