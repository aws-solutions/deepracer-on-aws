// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { Model, ModelSource, ModelStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import TrainingConfiguration from './TrainingConfiguration';
import TrainingDetails from './TrainingDetails';

interface TrainingTabProps {
  model: Model;
}

const TrainingTab = ({ model }: TrainingTabProps) => {
  const { t } = useTranslation('modelDetails');
  const isPhysicalModel = model.modelSource === ModelSource.IMPORTED_PHYSICAL;

  if (isPhysicalModel && model.status === ModelStatus.IMPORTING) {
    return <StatusIndicator type="in-progress">{t('trainingTab.importingStatus')}</StatusIndicator>;
  }

  return (
    <SpaceBetween size="l">
      {!isPhysicalModel && <TrainingDetails model={model} />}
      <TrainingConfiguration model={model} />
    </SpaceBetween>
  );
};

export default TrainingTab;
