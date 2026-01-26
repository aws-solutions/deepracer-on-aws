// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import RadioGroup from '@cloudscape-design/components/radio-group';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { EvaluationConfig, RaceType, TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import * as Yup from 'yup';

import fixedObjectPositionsImage from '#assets/images/fixedObjectPositions.png';
import randomizedObjectPositionImage from '#assets/images/randomizedObjectPositions.png';
import InputField from '#components/FormFields/InputField';
import SelectField from '#components/FormFields/SelectField';
import TilesField from '#components/FormFields/TilesField';
import TrackSelection from '#components/TrackSelection';
import { PageId } from '#constants/pages';
import { DEFAULT_OBJECT_POSITIONS, TRACKS } from '#constants/tracks';
import { RESOURCE_NAME_MAX_LENGTH, RESOURCE_NAME_REGEX } from '#constants/validation';
import i18n from '#i18n/index';
import { useCreateEvaluationMutation } from '#services/deepRacer/evaluationsApi';
import { useGetModelQuery } from '#services/deepRacer/modelsApi';
import { getPath } from '#utils/pageUtils';
import { validateObjectPositions } from '#utils/validationUtils';

const OBSTACLE_LOCATION_OPTIONS = [
  {
    value: 'FIXED',
    label: i18n.t('createEvaluation:raceType.objectAvoidance.objectLocationType.fixedLocationLabel'),
    description: i18n.t('createEvaluation:raceType.objectAvoidance.objectLocationType.fixedLocationLabel'),
  },
  {
    value: 'RANDOMIZED',
    label: i18n.t('createEvaluation:raceType.objectAvoidance.objectLocationType.randomizedLocationLabel'),
    description: i18n.t('createEvaluation:raceType.objectAvoidance.objectLocationType.randomizedLocationDescription'),
  },
];

interface ValidateOptionsExtended {
  options: {
    index: number;
  };
}

interface CreateEvaluationFormValues {
  modelId: string;
  evaluationConfig: EvaluationConfig;
}

const schema = Yup.object().shape({
  modelId: Yup.string().required(),
  evaluationConfig: Yup.object().shape({
    evaluationName: Yup.string()
      .required(i18n.t('createModel:requiredError'))
      .matches(RESOURCE_NAME_REGEX, i18n.t('createModel:modelInfo.trainingDetailsSection.modelNameError'))
      .max(RESOURCE_NAME_MAX_LENGTH, i18n.t('createModel:modelInfo.trainingDetailsSection.modelNameLengthError')),
    maxLaps: Yup.number().required(),
    resettingBehaviorConfig: Yup.object().shape({
      continuousLap: Yup.boolean().required(),
      collisionPenaltySeconds: Yup.number(),
      offTrackPenaltySeconds: Yup.number(),
    }),
    trackConfig: Yup.object().shape({
      trackId: Yup.mixed<TrackId>().required(),
      trackDirection: Yup.mixed<TrackDirection>().required(),
    }),
    maxTimeInMinutes: Yup.number().required(),
    raceType: Yup.mixed<RaceType>().required(i18n.t('createModel:requiredError')),
    objectAvoidanceConfig: Yup.object()
      .optional()
      .shape({
        numberOfObjects: Yup.number()
          .min(1, i18n.t('createModel:modelInfo.objectAvoidanceConfig.minimumNumberOfObjectsError'))
          .max(6, i18n.t('createModel:modelInfo.objectAvoidanceConfig.maximumNumberOfObjectsError'))
          .required(i18n.t('createModel:requiredError')),
        objectPositions: Yup.array().of(
          Yup.object().shape({
            laneNumber: Yup.number().required('createModel:requiredError'),
            trackPercentage: Yup.number()
              .min(0.07, i18n.t('createModel:modelInfo.objectAvoidanceConfig.trackPercentageMinError'))
              .max(0.9, i18n.t('createModel:modelInfo.objectAvoidanceConfig.trackPercentageMaxError'))
              .test(
                'validate track percentage distances',
                i18n.t('createModel:modelInfo.objectAvoidanceConfig.trackPercentageGap'),
                (_, context) => {
                  const currentContext = context as Yup.TestContext & ValidateOptionsExtended;
                  const objectPositions = currentContext?.from?.[1]?.value?.objectPositions ?? [];
                  const index = parseInt(currentContext.path.split('[')[1].split(']')[0], 10);
                  return validateObjectPositions(objectPositions, index);
                },
              )
              .required(i18n.t('createModel:requiredError')),
          }),
        ),
      }),
  }),
});

// TODO: allow user to set continuous laps

const CreateEvaluation = () => {
  const { t } = useTranslation('createEvaluation');
  const { modelId = '' } = useParams();
  const [createEvaluation, { isLoading: isCreateEvaluationLoading }] = useCreateEvaluationMutation();
  const [isRandomizedLocation, setIsRandomizedLocation] = useState(false);
  const [shouldNavigateAfterRefresh, setShouldNavigateAfterRefresh] = useState(false);
  const navigate = useNavigate();

  // Monitor model state to detect when cache invalidation completes, to allow navigation to the details page
  const { isFetching: isModelFetching } = useGetModelQuery({ modelId });
  const initialValues: CreateEvaluationFormValues = {
    modelId: modelId,
    evaluationConfig: {
      evaluationName: '',
      maxLaps: 3,
      resettingBehaviorConfig: {
        continuousLap: false,
      },
      trackConfig: {
        trackId: TrackId.A_TO_Z_SPEEDWAY,
        trackDirection: TrackDirection.COUNTER_CLOCKWISE,
      },
      maxTimeInMinutes: 20,
      raceType: RaceType.TIME_TRIAL,
      objectAvoidanceConfig: {
        numberOfObjects: 3,
        objectPositions: [
          { laneNumber: -1, trackPercentage: 0.1 },
          { laneNumber: 1, trackPercentage: 0.24 },
          { laneNumber: -1, trackPercentage: 0.37 },
        ],
      },
    },
  };

  const { control, getValues, handleSubmit, setValue } = useForm<CreateEvaluationFormValues>({
    mode: 'onSubmit',
    resolver: yupResolver(schema),
    values: initialValues,
  });

  useEffect(() => {
    if (shouldNavigateAfterRefresh && !isModelFetching) {
      navigate(getPath(PageId.MODEL_DETAILS, { modelId: getValues('modelId') }), {
        state: { activeTabId: 'evaluation' },
      });
      setShouldNavigateAfterRefresh(false);
    }
  }, [shouldNavigateAfterRefresh, isModelFetching, navigate, getValues]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'evaluationConfig.objectAvoidanceConfig.objectPositions',
  });
  const numberOfObjects = useWatch({ control, name: 'evaluationConfig.objectAvoidanceConfig.numberOfObjects' });
  const currentRaceType = useWatch({ control, name: 'evaluationConfig.raceType' });

  const onSubmit = async (updatedCreateEvaluationForm: CreateEvaluationFormValues) => {
    await createEvaluation(updatedCreateEvaluationForm)
      .unwrap()
      .then(() => {
        setShouldNavigateAfterRefresh(true);
      });
  };

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
    <ContentLayout header={<Header variant="h1">{t('header')}</Header>}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                formAction="none"
                onClick={() => {
                  navigate(getPath(PageId.MODEL_DETAILS, { modelId: getValues('modelId') }), {
                    state: { activeTabId: 'evaluation' },
                  });
                }}
              >
                {t('cancelButton')}
              </Button>
              <Button loading={isCreateEvaluationLoading} variant="primary">
                {t('startButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Container header={<Header>{t('raceType.header')}</Header>}>
              <SpaceBetween size="xs">
                <InputField
                  control={control}
                  constraintText={t('raceType.nameInput.footer')}
                  description={t('raceType.nameInput.description')}
                  label={t('raceType.nameInput.label')}
                  name="evaluationConfig.evaluationName"
                />
                <TilesField
                  control={control}
                  columns={2}
                  label={t('raceType.tiles.label')}
                  name="evaluationConfig.raceType"
                  items={[
                    {
                      label: t('raceType.tiles.timeTrialLabel'),
                      description: t('raceType.tiles.timeTrialDescription'),
                      value: RaceType.TIME_TRIAL,
                    },
                    {
                      label: t('raceType.tiles.objectAvoidanceLabel'),
                      description: t('raceType.tiles.objectAvoidanceDescription'),
                      value: RaceType.OBJECT_AVOIDANCE,
                    },
                  ]}
                />
                {currentRaceType === RaceType.OBJECT_AVOIDANCE && (
                  <div>
                    <Grid gridDefinition={[{ colspan: { m: 6, xs: 6, xxs: 3 } }, { colspan: { m: 6, xs: 6, xxs: 3 } }]}>
                      <SpaceBetween direction="vertical" size="xxl">
                        <SpaceBetween direction="vertical" size="s">
                          <Box>{t('raceType.objectAvoidance.objectLocationType.label')}</Box>
                          <RadioGroup
                            onChange={({ detail }) => {
                              if (detail.value === OBSTACLE_LOCATION_OPTIONS[1].value) {
                                setIsRandomizedLocation(true);
                                setValue('evaluationConfig.objectAvoidanceConfig.objectPositions', []);
                              } else {
                                setIsRandomizedLocation(false);
                              }
                            }}
                            value={
                              isRandomizedLocation
                                ? OBSTACLE_LOCATION_OPTIONS[1].value
                                : OBSTACLE_LOCATION_OPTIONS[0].value
                            }
                            items={OBSTACLE_LOCATION_OPTIONS}
                          />
                        </SpaceBetween>
                        <SelectField
                          control={control}
                          label={t('raceType.objectAvoidance.numberOfObjects.label')}
                          description={t('raceType.objectAvoidance.numberOfObjects.description')}
                          name="evaluationConfig.objectAvoidanceConfig.numberOfObjects"
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
                      </SpaceBetween>
                      <Box>
                        <img
                          alt={t('raceType.objectAvoidance.objectPositionImageAlt')}
                          src={isRandomizedLocation ? randomizedObjectPositionImage : fixedObjectPositionsImage}
                        />
                      </Box>
                    </Grid>
                    <Box margin={{ top: 'xxl' }}>
                      {fields.map((field, index) => (
                        <div key={field.id}>
                          <FormField label={t('raceType.objectAvoidance.obstacle.label', { count: index + 1 })}>
                            <ColumnLayout columns={2}>
                              <SelectField
                                control={control}
                                label={t('raceType.objectAvoidance.obstacle.lanePlacement')}
                                name={`evaluationConfig.objectAvoidanceConfig.objectPositions.${index}.laneNumber`}
                                options={[
                                  {
                                    label: t('raceType.objectAvoidance.obstacle.outsideLane'),
                                    value: -1,
                                  },
                                  {
                                    label: t('raceType.objectAvoidance.obstacle.insideLane'),
                                    value: 1,
                                  },
                                ]}
                                type="number"
                              />
                              <InputField
                                control={control}
                                inputMode="decimal"
                                label={t('raceType.objectAvoidance.obstacle.trackPercentage')}
                                name={`evaluationConfig.objectAvoidanceConfig.objectPositions.${index}.trackPercentage`}
                                type="number"
                              />
                            </ColumnLayout>
                          </FormField>
                          <br />
                        </div>
                      ))}
                    </Box>
                  </div>
                )}
              </SpaceBetween>
            </Container>
            <Container
              header={
                <Header
                  counter={t('evaluateCriteria.trackItemsCount', { count: TRACKS.length })}
                  description={t('evaluateCriteria.description')}
                >
                  {t('evaluateCriteria.header')}
                </Header>
              }
            >
              <SpaceBetween direction="vertical" size="l">
                <TrackSelection
                  control={control}
                  setValue={setValue}
                  trackConfigFieldName="evaluationConfig.trackConfig"
                />
                <SelectField
                  control={control}
                  label={t('evaluateCriteria.numberOfLaps.header')}
                  name="evaluationConfig.maxLaps"
                  options={[3, 4, 5].map((count) => {
                    return {
                      label: t('evaluateCriteria.numberOfLaps.lapCount', { count }),
                      value: count,
                    };
                  })}
                  type="number"
                ></SelectField>
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        </Form>
      </form>
    </ContentLayout>
  );
};

export default CreateEvaluation;
