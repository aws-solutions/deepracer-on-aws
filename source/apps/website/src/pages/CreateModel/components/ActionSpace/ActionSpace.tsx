// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tiles from '@cloudscape-design/components/tiles';
import { AgentAlgorithm } from '@deepracer-indy/typescript-client';
import { Control, UseFormResetField, UseFormSetValue, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';

import { DEFAULT_DISCRETE_ACTION_SPACE } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import ContinuousActionSpaceSection from './components/ContinuousActionSpace/ContinuousActionSpaceSection';
import DiscreteActionSpaceSection from './components/DiscreteActionSpace/DiscreteActionSpaceSection';
import { ActionSpaceType } from './constants';

import './styles.css';

interface ActionSpaceProps {
  control: Control<CreateModelFormValues>;
  resetField: UseFormResetField<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const ActionSpaceStep = ({ control, resetField, setValue }: ActionSpaceProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'actionSpace' });

  const actionSpace = useWatch({ control, name: 'metadata.actionSpace' });
  const agentAlgorithm = useWatch({ control, name: 'metadata.agentAlgorithm' });
  const preTrainedModelId = useWatch({ control, name: 'preTrainedModelId' });

  const actionSpaceType = actionSpace.continous ? ActionSpaceType.CONTINUOUS : ActionSpaceType.DISCRETE;
  const isClonedModel = !!preTrainedModelId;
  const showActionSpaceSelector = !isClonedModel && agentAlgorithm !== AgentAlgorithm.SAC;

  return (
    <SpaceBetween direction="vertical" size="l">
      <ExpandableSection headerText={t('actionSpaceImportant')} variant="container" defaultExpanded>
        <Trans t={t}>
          <Box variant="p">{t('actionSpaceImportantDescription')}</Box>
        </Trans>
      </ExpandableSection>
      {showActionSpaceSelector && (
        <Container header={<Header variant="h2">{t('selectActionSpaceHeader')}</Header>}>
          <FormField label={t('actionSpaces')} stretch>
            <Tiles
              items={[
                {
                  label: t('continuousActionSpace'),
                  description: t('continuousActionSpaceDescription'),
                  value: ActionSpaceType.CONTINUOUS,
                },
                {
                  label: t('discreteActionSpace'),
                  description: t('discreteActionSpaceDescription'),
                  value: ActionSpaceType.DISCRETE,
                },
              ]}
              onChange={({ detail }) => {
                if (detail.value === ActionSpaceType.CONTINUOUS) {
                  resetField('metadata.actionSpace');
                } else {
                  setValue('metadata.actionSpace', {
                    discrete: DEFAULT_DISCRETE_ACTION_SPACE,
                  });
                }
              }}
              value={actionSpaceType}
            />
          </FormField>
        </Container>
      )}
      {actionSpaceType === ActionSpaceType.CONTINUOUS && (
        <ContinuousActionSpaceSection control={control} resetField={resetField} setValue={setValue} />
      )}
      {actionSpaceType === ActionSpaceType.DISCRETE && (
        <DiscreteActionSpaceSection control={control} resetField={resetField} setValue={setValue} />
      )}
    </SpaceBetween>
  );
};

export default ActionSpaceStep;
