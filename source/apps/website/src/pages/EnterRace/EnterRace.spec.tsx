// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CheckpointSelection, CreateSubmissionCommand } from '@deepracer-indy/typescript-client';
import { composeStories } from '@storybook/react';
import { expect, userEvent, waitFor } from '@storybook/test';

import { mockModel, mockModel2 } from '#constants/testConstants';
import i18n from '#i18n/index.js';
import { mockDeepRacerClient, screen } from '#utils/testUtils';

import * as stories from './EnterRace.stories';

const { Default, LiveRaceFiltered, WithCheckpoints, WithPhysicalModel } = composeStories(stories);

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

  it('filters out already-submitted models for live races', async () => {
    await LiveRaceFiltered.run();

    await screen.findByText(i18n.t('enterRace:chooseModel'));
    await expect(screen.getByText(i18n.t('enterRace:selection'))).toBeInTheDocument();
  });

  it('does not show physical models in model selection (filtered by modelSource)', async () => {
    await WithPhysicalModel.run();

    // Wait for model selection section to render
    await screen.findByText(i18n.t('enterRace:chooseModel'));
    // Physical model should be filtered out even though it's in the API response
    await expect(screen.queryByText('my-physical-model')).not.toBeInTheDocument();
  });

  it("offers the chosen model's checkpoints, starts again from Best for each model, and sends the choice", async () => {
    await WithCheckpoints.run();
    mockDeepRacerClient.on(CreateSubmissionCommand).resolves({ submissionId: 'submission-1' });

    await userEvent.click(await screen.findByText(i18n.t('enterRace:chooseAModel')));
    await userEvent.click(await screen.findByText(mockModel.name));
    await userEvent.click(await screen.findByText(i18n.t('common:checkpoint.last.label')));

    // Choosing another model resets the choice, since each model has its own checkpoints.
    await userEvent.click(screen.getByText(mockModel.name));
    await userEvent.click(await screen.findByText(mockModel2.name));
    await userEvent.click(await screen.findByText(i18n.t('common:checkpoint.last.label')));

    await userEvent.click(screen.getByRole('button', { name: i18n.t('enterRace:enterRace') }));

    await waitFor(() =>
      expect(mockDeepRacerClient.commandCalls(CreateSubmissionCommand)[0]?.args[0].input).toMatchObject({
        modelId: mockModel2.modelId,
        checkpoint: CheckpointSelection.LAST,
      }),
    );
  });

  it('starts from Best when another model is chosen', async () => {
    await WithCheckpoints.run();

    await userEvent.click(await screen.findByText(i18n.t('enterRace:chooseAModel')));
    await userEvent.click(await screen.findByText(mockModel.name));
    await userEvent.click(await screen.findByText(i18n.t('common:checkpoint.last.label')));
    await userEvent.click(screen.getByText(mockModel.name));
    await userEvent.click(await screen.findByText(mockModel2.name));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: new RegExp(i18n.t('common:checkpoint.best.label')) })).toBeChecked(),
    );
  });
});
