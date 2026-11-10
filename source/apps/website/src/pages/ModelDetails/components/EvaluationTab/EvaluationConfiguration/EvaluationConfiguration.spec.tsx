// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CheckpointSelection } from '@deepracer-indy/typescript-client';

import { mockEvaluationCompleted } from '#constants/testConstants';
import i18n from '#i18n';
import { render, screen } from '#utils/testUtils';

import EvaluationConfiguration from './EvaluationConfiguration';

describe('<EvaluationConfiguration />', () => {
  it('shows the checkpoint the evaluation used', () => {
    render(
      <EvaluationConfiguration
        evaluation={{
          ...mockEvaluationCompleted,
          config: { ...mockEvaluationCompleted.config, checkpoint: CheckpointSelection.LAST },
        }}
      />,
    );

    expect(
      screen.getByText(i18n.t('modelDetails:evaluationConfiguration.keyValueLabels.checkpoint')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:checkpoint.values.LAST'))).toBeInTheDocument();
  });

  it('shows Best for an evaluation made before the checkpoint was recorded', () => {
    render(
      <EvaluationConfiguration
        evaluation={{
          ...mockEvaluationCompleted,
          config: { ...mockEvaluationCompleted.config, checkpoint: undefined },
        }}
      />,
    );

    expect(screen.getByText(i18n.t('common:checkpoint.values.BEST'))).toBeInTheDocument();
  });
});
