// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import DefineRewardSlide from './DefineRewardSlide';

describe('<DefineRewardSlide />', () => {
  it('should render the define reward slide', () => {
    render(<DefineRewardSlide subStep={0} />);
    const DefineRewardSlideContainer = screen.queryByTestId('defineRewardSlideContainer');
    const DefineRewardSlideText = screen.queryByTestId('defineRewardSlideText');
    const DefineRewardSlideGraphic = screen.queryByTestId('defineRewardSlideGraphic');
    const Header = screen.queryByText('The Reward Function');

    expect(DefineRewardSlideContainer).toBeDefined();
    expect(DefineRewardSlideContainer?.className).toBe('defineRewardSlideContainer');
    expect(DefineRewardSlideText).toBeDefined();
    expect(DefineRewardSlideText?.className).toBe('defineRewardSlideText');
    expect(DefineRewardSlideGraphic).toBeDefined();
    expect(DefineRewardSlideGraphic?.className).toBe('defineRewardSlideGraphic');
    expect(Header?.textContent).toBe('The Reward Function');
  });

  describe('DefineRewardSlide substeps', () => {
    it('should render the define reward slide substep 0', () => {
      render(<DefineRewardSlide subStep={0} />);
      const DefineRewardSlideContainer = screen.queryByTestId('defineRewardSlideContainer');
      const DefineRewardSlideText = screen.queryByTestId('defineRewardSlideText');
      const DefineRewardSlideGraphic = screen.queryByTestId('defineRewardSlideGraphic');
      const DefineRewardSlideSubStep0 = screen.queryByTestId('defineRewardSlide-subStep0');
      const Header = screen.queryByText('Putting it all together');

      expect(DefineRewardSlideContainer).toBeDefined();
      expect(DefineRewardSlideContainer?.className).toBe('defineRewardSlideContainer');
      expect(DefineRewardSlideText).toBeDefined();
      expect(DefineRewardSlideText?.className).toBe('defineRewardSlideText');
      expect(DefineRewardSlideGraphic).toBeDefined();
      expect(DefineRewardSlideGraphic?.className).toBe('defineRewardSlideGraphic');
      expect(DefineRewardSlideSubStep0).toBeDefined();
      expect(Header?.textContent).toBe('Putting it all together');
    });

    it('should render the define reward slide substep 1', () => {
      render(<DefineRewardSlide subStep={1} />);
      const DefineRewardSlideContainer = screen.queryByTestId('defineRewardSlideContainer');
      const DefineRewardSlideText = screen.queryByTestId('defineRewardSlideText');
      const DefineRewardSlideGraphic = screen.queryByTestId('defineRewardSlideGraphic');
      const DefineRewardSlideSubStep = screen.queryByTestId('defineRewardSlide-subStep1');
      const Header = screen.queryByText('1. Stay On Track');

      expect(DefineRewardSlideContainer).toBeDefined();
      expect(DefineRewardSlideContainer?.className).toBe('defineRewardSlideContainer');
      expect(DefineRewardSlideText).toBeDefined();
      expect(DefineRewardSlideText?.className).toBe('defineRewardSlideText');
      expect(DefineRewardSlideGraphic).toBeDefined();
      expect(DefineRewardSlideGraphic?.className).toBe('defineRewardSlideGraphic');
      expect(DefineRewardSlideSubStep).toBeDefined();
      expect(Header?.textContent).toBe('1. Stay On Track');
    });

    it('should render the define reward slide substep 2', () => {
      render(<DefineRewardSlide subStep={2} />);
      const DefineRewardSlideContainer = screen.queryByTestId('defineRewardSlideContainer');
      const DefineRewardSlideText = screen.queryByTestId('defineRewardSlideText');
      const DefineRewardSlideGraphic = screen.queryByTestId('defineRewardSlideGraphic');
      const DefineRewardSlideSubStep = screen.queryByTestId('defineRewardSlide-subStep2');
      const Header = screen.queryByText('2. Follow Center Line');

      expect(DefineRewardSlideContainer).toBeDefined();
      expect(DefineRewardSlideContainer?.className).toBe('defineRewardSlideContainer');
      expect(DefineRewardSlideText).toBeDefined();
      expect(DefineRewardSlideText?.className).toBe('defineRewardSlideText');
      expect(DefineRewardSlideGraphic).toBeDefined();
      expect(DefineRewardSlideGraphic?.className).toBe('defineRewardSlideGraphic');
      expect(DefineRewardSlideSubStep).toBeDefined();
      expect(Header?.textContent).toBe('2. Follow Center Line');
    });

    it('should render the define reward slide substep 3', () => {
      render(<DefineRewardSlide subStep={3} />);
      const DefineRewardSlideContainer = screen.queryByTestId('defineRewardSlideContainer');
      const DefineRewardSlideText = screen.queryByTestId('defineRewardSlideText');
      const DefineRewardSlideGraphic = screen.queryByTestId('defineRewardSlideGraphic');
      const DefineRewardSlideSubStep = screen.queryByTestId('defineRewardSlide-subStep3');
      const Header = screen.queryByText('3. Prevent zig-zag');

      expect(DefineRewardSlideContainer).toBeDefined();
      expect(DefineRewardSlideContainer?.className).toBe('defineRewardSlideContainer');
      expect(DefineRewardSlideText).toBeDefined();
      expect(DefineRewardSlideText?.className).toBe('defineRewardSlideText');
      expect(DefineRewardSlideGraphic).toBeDefined();
      expect(DefineRewardSlideGraphic?.className).toBe('defineRewardSlideGraphic');
      expect(DefineRewardSlideSubStep).toBeDefined();
      expect(Header?.textContent).toBe('3. Prevent zig-zag');
    });
  });
});
