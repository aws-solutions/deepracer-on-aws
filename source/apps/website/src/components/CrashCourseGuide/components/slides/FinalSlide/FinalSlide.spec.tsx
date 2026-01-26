// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import FinalSlide from './FinalSlide';

describe('<FinalSlide />', () => {
  it('should render the final slide', () => {
    render(
      <FinalSlide
        setIsVisible={(visible: boolean) => {
          return visible;
        }}
      />,
    );
    const FinalSlideContainer = screen.queryByTestId('finalSlideContainer');
    const Header = screen.queryByText('Congratulations!');

    expect(FinalSlideContainer).toBeDefined();
    expect(FinalSlideContainer?.className).toBe('finalSlideContainer');
    expect(Header?.textContent).toBe('Congratulations!');
  });
});
