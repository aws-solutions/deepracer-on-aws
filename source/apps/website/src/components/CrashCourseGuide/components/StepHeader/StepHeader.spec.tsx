// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import { render, screen } from '#utils/testUtils';

import * as stories from './StepHeader.stories';

const { Default } = composeStories(stories);

describe('<StepHeader />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
  });
});
