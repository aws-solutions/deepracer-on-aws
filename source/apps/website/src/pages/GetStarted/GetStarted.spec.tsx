// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import i18n from 'i18next';

import * as stories from '#pages/GetStarted/GetStarted.stories';
import { render, screen } from '#utils/testUtils';

const { Default } = composeStories(stories);

describe('<GetStarted />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(i18n.t('getStarted:rlFtueHeader'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('getStarted:rlFtueDescription'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('getStarted:rlFtueButtonText') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('getStarted:modelCreateHeader'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('getStarted:modelCreateButtonText') })).toBeInTheDocument();
  });
});
