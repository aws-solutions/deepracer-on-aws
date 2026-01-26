// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import * as stories from './AppLayout.stories';
import i18n from '../../i18n/index.js';
import { screen } from '../../utils/testUtils.js';

const { Default } = composeStories(stories);

describe('<AppLayout />', () => {
  it('should render without crashing', async () => {
    await Default.run();

    const appTitle = (await screen.findAllByText(i18n.t('common:serviceName')))[0];
    expect(appTitle).toBeInTheDocument();
  });
});
