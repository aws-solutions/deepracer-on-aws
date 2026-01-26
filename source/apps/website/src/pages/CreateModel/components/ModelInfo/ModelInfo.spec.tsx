// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import i18n from '#i18n';
import { screen } from '#utils/testUtils';

import * as ModelInfoStories from './ModelInfo.stories';

const { Default } = composeStories(ModelInfoStories);

describe('<ModelInfo />', () => {
  it('renders without crashing', async () => {
    await Default.run();

    expect(screen.getByText(i18n.t('createModel:modelInfo.overviewSection.header'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createModel:modelInfo.trainingDetailsSection.header'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createModel:modelInfo.trackSelectionSection.header'))).toBeInTheDocument();
  });
});
