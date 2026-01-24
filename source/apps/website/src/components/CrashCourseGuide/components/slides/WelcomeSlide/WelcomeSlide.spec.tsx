// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import WelcomeSlide from './WelcomeSlide';

describe('<WeclomeSlide />', () => {
  it('should render the welcome slide', () => {
    render(<WelcomeSlide />);
    const WelcomeSlideDiv = screen.queryByTestId('welcomeSlide');
    const Header = screen.queryByText('Developers, start your engines!');

    expect(WelcomeSlideDiv).toBeDefined();
    expect(WelcomeSlideDiv?.className).toBe('welcomeSlideContainer');
    expect(Header?.textContent).toBeDefined();
  });
});
