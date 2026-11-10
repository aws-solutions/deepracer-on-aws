// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import i18n from '#i18n';
import { screen } from '#utils/testUtils';

import * as ModelInfoStories from './ModelInfo.stories';

const { Clone, Default } = composeStories(ModelInfoStories);

describe('<ModelInfo />', () => {
  it('renders without crashing', async () => {
    await Default.run();

    expect(screen.getByText(i18n.t('createModel:modelInfo.overviewSection.header'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createModel:modelInfo.trainingDetailsSection.header'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createModel:modelInfo.trackSelectionSection.header'))).toBeInTheDocument();
    // A new model has no source model, so there is no checkpoint to start from.
    expect(screen.queryByText(i18n.t('common:checkpoint.best.label'))).not.toBeInTheDocument();
  });

  it("offers the source model's checkpoints when cloning", async () => {
    await Clone.run();

    expect(
      await screen.findByText(
        i18n.t('common:checkpoint.iterationWithCompletion', { iteration: 15, completionPercentage: 88 }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: new RegExp(i18n.t('common:checkpoint.best.label')) })).toBeChecked();
  });
});
