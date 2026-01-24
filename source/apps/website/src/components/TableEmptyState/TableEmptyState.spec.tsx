// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import * as stories from './TableEmptyState.stories';
import { render, screen } from '../../utils/testUtils.js';

const { Default } = composeStories(stories);

describe('<TableEmptyState />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(Default.args.title as string)).toBeInTheDocument();
    expect(screen.getByText(Default.args.subtitle as string)).toBeInTheDocument();
  });
});
