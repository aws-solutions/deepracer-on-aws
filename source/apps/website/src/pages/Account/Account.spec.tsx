// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import i18n from '#i18n/index.js';
import { render, screen } from '#utils/testUtils';

import * as stories from './Account.stories';

const { Default } = composeStories(stories);

describe('<Account />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByTestId('accountHeader')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:yourAccountInfo'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:yourEmail'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:yourPassword'))).toBeInTheDocument();
  });
});
