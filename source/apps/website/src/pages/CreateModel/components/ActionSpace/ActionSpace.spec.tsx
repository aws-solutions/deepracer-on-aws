// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import i18n from '#i18n';
import { fireEvent, screen } from '#utils/testUtils';

import * as ActionSpaceStories from './ActionSpace.stories';

const { Default, ClonedContinuousModel, SacAgentAlgorithmModel } = composeStories(ActionSpaceStories);

describe('<ActionSpace />', () => {
  const continousSectionHeaderText = i18n.t('createModel:actionSpace.continuousSection.defineHeader');
  const discreteTileDescriptionText = i18n.t('createModel:actionSpace.discreteActionSpaceDescription');
  const discreteSectionHeaderText = i18n.t('createModel:actionSpace.discreteSection.defineHeader');

  it('renders action space selection for default create model flow', async () => {
    await Default.run();

    const continuousConfigHeader = screen.getByText(continousSectionHeaderText);
    const discreteTile = screen.getByText(discreteTileDescriptionText);

    expect(continuousConfigHeader).toBeInTheDocument();
    expect(discreteTile).toBeInTheDocument();

    fireEvent.click(discreteTile);

    expect(continuousConfigHeader).not.toBeInTheDocument();
    expect(screen.getByText(discreteSectionHeaderText)).toBeInTheDocument();
  });

  it('renders no action space selector and displays continous config when flow is for a cloned continous model', async () => {
    await ClonedContinuousModel.run();

    // Continuous config open
    expect(screen.getByText(continousSectionHeaderText)).toBeInTheDocument();
    // Action space selector is not present for cloned models
    expect(screen.queryByText(discreteTileDescriptionText)).not.toBeInTheDocument();
  });

  it('renders no action space selector and displays continous config when flow is for a model with SAC agent algorithm', async () => {
    await SacAgentAlgorithmModel.run();

    // Continuous config open
    expect(screen.getByText(continousSectionHeaderText)).toBeInTheDocument();
    // Action space selector is not present for models using SAC agent algorithm
    expect(screen.queryByText(discreteTileDescriptionText)).not.toBeInTheDocument();
  });
});
