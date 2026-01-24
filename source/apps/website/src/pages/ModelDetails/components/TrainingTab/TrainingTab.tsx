// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SpaceBetween from '@cloudscape-design/components/space-between';
import { Model } from '@deepracer-indy/typescript-client';

import TrainingConfiguration from './TrainingConfiguration';
import TrainingDetails from './TrainingDetails';

interface TrainingTabProps {
  model: Model;
}

const TrainingTab = ({ model }: TrainingTabProps) => {
  return (
    <SpaceBetween size="l">
      <TrainingDetails model={model} />
      <TrainingConfiguration model={model} />
    </SpaceBetween>
  );
};

export default TrainingTab;
