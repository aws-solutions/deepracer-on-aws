// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { expect, waitFor } from '@storybook/test';

import i18n from '#i18n/index.js';
import { screen } from '#utils/testUtils';

import * as stories from './EnterRace.stories';

const { Default } = composeStories(stories);

describe('<EnterRace />', () => {
  it('TT leaderboard renders without crashing', async () => {
    await Default.run();

    // Header
    await waitFor(() => expect(screen.getAllByText(i18n.t('enterRace:enterRace'))[0]).toBeInTheDocument());

    // Race details items
    await screen.findByText(i18n.t('raceDetails:raceTrackColumn.competitionTrack'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.rankingMethod'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.style'));
    await screen.findByText(i18n.t('raceDetails:raceRulesColumn.offTrackPenalty'));

    // Choose model items
    await screen.findByText(i18n.t('enterRace:chooseModel'));
    await screen.findByText(i18n.t('enterRace:selection'));
    await screen.findByText(i18n.t('enterRace:chooseAModel'));

    // Buttons
    await expect(
      screen.getByRole('button', {
        name: 'Enter race',
      }),
    ).toBeInTheDocument();
    await expect(
      screen.getByRole('button', {
        name: 'Cancel',
      }),
    ).toBeInTheDocument();
  });
});
