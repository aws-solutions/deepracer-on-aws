// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Wizard from '@cloudscape-design/components/wizard';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { useCreateModelMutation } from '#services/deepRacer/modelsApi.js';
import { getPath } from '#utils/pageUtils.js';

import ActionSpaceSection from './components/ActionSpace';
import CarShellSelection from './components/CarShellSelection';
import ModelInfo from './components/ModelInfo';
import RewardFunction from './components/RewardFunction';
import VehicleInfo from './components/VehicleInfo';
import { initialFormValues } from './constants';
import { CreateModelFormValues } from './types';
import { createModelValidationSchema } from './validation';

const CreateModel = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('createModel');

  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const [createModel, { isLoading: isCreateModelLoading, error: createModelError }] = useCreateModelMutation();

  const { control, resetField, setValue, handleSubmit, trigger } = useForm<CreateModelFormValues>({
    mode: 'onChange',
    defaultValues: state?.clonedModelFormValues ?? initialFormValues,
    resolver: yupResolver(createModelValidationSchema),
  });

  return (
    <Wizard
      i18nStrings={{
        stepNumberLabel: (stepNumber) => t('wizard.stepNumberLabel', { stepNumber }),
        collapsedStepsLabel: (stepNumber, stepsCount) => t('wizard.collapsedStepsLabel', { stepNumber, stepsCount }),
        cancelButton: t('wizard.cancelButton'),
        previousButton: t('wizard.previousButton'),
        nextButton: t('wizard.nextButton'),
        submitButton: t('wizard.submitButton'),
        optional: t('wizard.optional'),
      }}
      isLoadingNextStep={isCreateModelLoading}
      onNavigate={async ({ detail }) => {
        const isValid = await trigger();
        if (isValid) {
          setActiveStepIndex(detail.requestedStepIndex);
        }
      }}
      onSubmit={async () => {
        await handleSubmit(async (formValues) => {
          await createModel({
            modelDefinition: {
              name: formValues.modelName,
              description: formValues.description,
              carCustomization: formValues.carCustomization,
              trainingConfig: formValues.trainingConfig,
              metadata: formValues.metadata,
            },
            preTrainedModelId: formValues.preTrainedModelId,
          })
            .unwrap()
            .then((modelId) => {
              navigate(getPath(PageId.MODEL_DETAILS, { modelId }));
            });
        })();
      }}
      onCancel={() => navigate(-1)}
      activeStepIndex={activeStepIndex}
      steps={[
        {
          title: t('wizard.stepTitles.modelInfo'),
          content: <ModelInfo control={control} setValue={setValue} resetField={resetField} />,
        },
        {
          title: t('wizard.stepTitles.trainingType'),
          content: <VehicleInfo control={control} setValue={setValue} />,
        },
        {
          title: t('wizard.stepTitles.actionSpace'),
          content: <ActionSpaceSection control={control} resetField={resetField} setValue={setValue} />,
        },
        {
          title: t('wizard.stepTitles.agentSelection'),
          content: <CarShellSelection control={control} setValue={setValue} />,
        },
        {
          title: t('wizard.stepTitles.rewardAlgorithm'),
          content: <RewardFunction control={control} setValue={setValue} />,
          errorText: createModelError as string,
        },
      ]}
    />
  );
};

export default CreateModel;
