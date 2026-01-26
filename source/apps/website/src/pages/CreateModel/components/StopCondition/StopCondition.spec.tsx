// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import i18n from '#i18n';
import { screen } from '#utils/testUtils';

import * as StopConditionStories from './StopCondition.stories';

const { Default } = composeStories(StopConditionStories);

describe('<StopCondition />', () => {
  it('renders without crashing', async () => {
    await Default.run();

    expect(screen.getByText(i18n.t('createModel:stopCondition.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createModel:stopCondition.content2'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createModel:stopCondition.maximumTimeInfo'))).toBeInTheDocument();
  });
});
