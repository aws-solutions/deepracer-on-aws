// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarColor } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';

import i18n from '#i18n';
import { screen } from '#utils/testUtils';

import * as TrimSelectionStories from './TrimSelection.stories';

const { Default } = composeStories(TrimSelectionStories);

describe('<TrimSelection />', () => {
  it('renders without crashing', async () => {
    await Default.run();

    expect(screen.getByText(i18n.t('createModel:carShellSelection.vehicleShell.trimTitle'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: CarColor.BLACK })).toBeInTheDocument();
  });
});
