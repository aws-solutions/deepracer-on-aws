// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import { render, screen } from '#utils/testUtils';

import * as stories from './StepInstructions.stories';

const { Default } = composeStories(stories);

describe('<StepInstructions />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(Default.args.title as string)).toBeInTheDocument();
    expect(screen.getByText(Default.args.description as string)).toBeInTheDocument();
  });
});
