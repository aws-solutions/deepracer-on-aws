// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import TrainingSlide from './TrainingSlide';

describe('<TrainingSlide />', () => {
  it('should render the training slide', () => {
    render(<TrainingSlide subStep={0} />);
    const TrainingSlideContainer = screen.queryByTestId('trainingSlideContainer');
    const TrainingSlideContent = screen.queryByTestId('trainingSlideContent');
    const TrainingSlideGraphic = screen.queryByTestId('trainingSlideGraphic');
    const Header = screen.queryByText('How to train a reinforcement learning model');

    expect(TrainingSlideContainer).toBeDefined();
    expect(TrainingSlideContainer?.className).toBe('trainingSlideContainer');
    expect(TrainingSlideContent).toBeDefined();
    expect(TrainingSlideContent?.className).toBe('trainingSlideContent');
    expect(TrainingSlideGraphic).toBeDefined();
    expect(TrainingSlideGraphic?.className).toBe('trainingSlideGraphic');
    expect(Header?.textContent).toBe('How to train a reinforcement learning model');
  });
});
