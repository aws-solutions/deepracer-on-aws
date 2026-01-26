// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import i18n from '#i18n/index.js';
import { render, screen } from '#utils/testUtils';

import * as stories from '../DeleteAccountModal.stories';

const { Default } = composeStories(stories);

describe('<DeleteAccountModal />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(i18n.t('account:deleteAccountModal.deleteAccountHeader'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:deleteAccountModal.deleteAccountInputHeader'))).toBeInTheDocument();
  });
});
