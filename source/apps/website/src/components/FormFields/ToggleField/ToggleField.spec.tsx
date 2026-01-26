// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import { render, screen } from '#utils/testUtils';

import * as stories from './ToggleField.stories';

const { Default } = composeStories(stories);

describe('<ToggleField />', () => {
  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(Default.args.label as string)).toBeInTheDocument();
    expect(screen.getByText(Default.args.children as string)).toBeInTheDocument();
  });
});
