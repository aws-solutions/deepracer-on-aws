// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import WhyRLSlide from './WhyRLSlide';

describe('<WhyRLSlide />', () => {
  it('should render the WhyRL slide', () => {
    render(<WhyRLSlide />);
    const WhyRLSlideContainer = screen.queryByTestId('whyRLSlideContainer');
    const WhyRLSlideContent = screen.queryByTestId('whyRLSlideContent');
    const WhyRLSlideImage = screen.queryByTestId('whyRLSlideImage');
    const Header = screen.queryByText('What is reinforcement learning?');

    expect(WhyRLSlideContainer).toBeDefined();
    expect(WhyRLSlideContainer?.className).toBe('whyRLSlideContainer');
    expect(WhyRLSlideContent).toBeDefined();
    expect(WhyRLSlideContent?.className).toBe('whyRLSlideContent');
    expect(WhyRLSlideImage).toBeDefined();
    expect(Header?.textContent).toBeDefined();
  });
});
