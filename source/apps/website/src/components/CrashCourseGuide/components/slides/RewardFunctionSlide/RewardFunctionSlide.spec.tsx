// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import RewardFunctionSlide from './RewardFunctionSlide';

describe('<RewardFunctionSlide />', () => {
  it('should render the reward function slide', () => {
    render(<RewardFunctionSlide subStep={6} />);
    const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
    const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
    const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
    const Header = screen.queryByText('Parameters of reward functions');

    expect(RewardFunctionSlideContainer).toBeDefined();
    expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
    expect(RewardFunctionSlideContent).toBeDefined();
    expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
    expect(RewardFunctionSlideGraphic).toBeDefined();
    expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
    expect(Header?.textContent).toBe('Parameters of reward functions');
  });

  describe('RewardFunctionSlide substeps', () => {
    it('should render the reward function slide substep 4', () => {
      render(<RewardFunctionSlide subStep={4} />);
      const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
      const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
      const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
      const RewardFunctionSlideSubStep4 = screen.queryByTestId('rewardFunctionSlide-subStep4');
      const Header = screen.queryByText('4. Track width');

      expect(RewardFunctionSlideContainer).toBeDefined();
      expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
      expect(RewardFunctionSlideContent).toBeDefined();
      expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
      expect(RewardFunctionSlideGraphic).toBeDefined();
      expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
      expect(RewardFunctionSlideSubStep4).toBeDefined();
      expect(Header?.textContent).toBe('4. Track width');
    });

    it('should render the reward function slide substep 5', () => {
      render(<RewardFunctionSlide subStep={5} />);
      const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
      const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
      const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
      const RewardFunctionSlideSubStep5 = screen.queryByTestId('rewardFunctionSlide-subStep5');
      const Header = screen.queryByText('5. Distance from center line');

      expect(RewardFunctionSlideContainer).toBeDefined();
      expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
      expect(RewardFunctionSlideContent).toBeDefined();
      expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
      expect(RewardFunctionSlideGraphic).toBeDefined();
      expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
      expect(RewardFunctionSlideSubStep5).toBeDefined();
      expect(Header?.textContent).toBe('5. Distance from center line');
    });

    it('should render the reward function slide substep 6', () => {
      render(<RewardFunctionSlide subStep={6} />);
      const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
      const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
      const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
      const RewardFunctionSlideSubStep6 = screen.queryByTestId('rewardFunctionSlide-subStep6');
      const Header = screen.queryByText('6. All wheels on track');

      expect(RewardFunctionSlideContainer).toBeDefined();
      expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
      expect(RewardFunctionSlideContent).toBeDefined();
      expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
      expect(RewardFunctionSlideGraphic).toBeDefined();
      expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
      expect(RewardFunctionSlideSubStep6).toBeDefined();
      expect(Header?.textContent).toBe('6. All wheels on track');
    });

    it('should render the reward function slide substep 7', () => {
      render(<RewardFunctionSlide subStep={7} />);
      const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
      const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
      const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
      const RewardFunctionSlideSubStep7 = screen.queryByTestId('rewardFunctionSlide-subStep7');
      const Header = screen.queryByText('7. Speed');

      expect(RewardFunctionSlideContainer).toBeDefined();
      expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
      expect(RewardFunctionSlideContent).toBeDefined();
      expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
      expect(RewardFunctionSlideGraphic).toBeDefined();
      expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
      expect(RewardFunctionSlideSubStep7).toBeDefined();
      expect(Header?.textContent).toBe('7. Speed');
    });

    it('should render the reward function slide substep 8', () => {
      render(<RewardFunctionSlide subStep={8} />);
      const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
      const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
      const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
      const RewardFunctionSlideSubStep8 = screen.queryByTestId('rewardFunctionSlide-subStep8');
      const Header = screen.queryByText('8. Steering angle');

      expect(RewardFunctionSlideContainer).toBeDefined();
      expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
      expect(RewardFunctionSlideContent).toBeDefined();
      expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
      expect(RewardFunctionSlideGraphic).toBeDefined();
      expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
      expect(RewardFunctionSlideSubStep8).toBeDefined();
      expect(Header?.textContent).toBe('8. Steering angle');
    });

    it('should render the reward function slide substep 9', () => {
      render(<RewardFunctionSlide subStep={9} />);
      const RewardFunctionSlideContainer = screen.queryByTestId('rewardFunctionSlideContainer');
      const RewardFunctionSlideContent = screen.queryByTestId('rewardFunctionSlideContent');
      const RewardFunctionSlideGraphic = screen.queryByTestId('rewardFunctionSlideGraphic');
      const RewardFunctionSlideSubStep9 = screen.queryByTestId('rewardFunctionSlide-subStep9');
      const Header = screen.queryByText('9. Summary');

      expect(RewardFunctionSlideContainer).toBeDefined();
      expect(RewardFunctionSlideContainer?.className).toBe('rewardFunctionSlideContainer');
      expect(RewardFunctionSlideContent).toBeDefined();
      expect(RewardFunctionSlideContent?.className).toBe('rewardFunctionSlideContent');
      expect(RewardFunctionSlideGraphic).toBeDefined();
      expect(RewardFunctionSlideGraphic?.className).toBe('rewardFunctionSlideGraphic');
      expect(RewardFunctionSlideSubStep9).toBeDefined();
      expect(Header?.textContent).toBe('9. Summary');
    });
  });
});
