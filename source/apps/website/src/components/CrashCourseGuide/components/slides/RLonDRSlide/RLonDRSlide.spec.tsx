// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '#utils/testUtils.js';

import RLonDRSlide from './RLonDRSlide';

describe('<RLonDRSlide />', () => {
  it('should render the RL on DR slide', () => {
    render(<RLonDRSlide subStep={0} />);
    const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
    const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
    const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
    const Header = screen.queryByText('How does AWS DeepRacer learn to drive by itself?');

    expect(RLonDRSlideContainer).toBeDefined();
    expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
    expect(RLonDRSlideContent).toBeDefined();
    expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
    expect(RLonDRSlideText).toBeDefined();
    expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
    expect(Header?.textContent).toBeDefined();
  });

  describe('RLonDRSlide substeps', () => {
    it('should render the RL on DR slide substep 0', () => {
      render(<RLonDRSlide subStep={0} />);
      const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
      const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
      const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
      const RLonDRSlideSubStep0 = screen.queryByTestId('rlOnDRSlide-subStep0');

      expect(RLonDRSlideContainer).toBeDefined();
      expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
      expect(RLonDRSlideContent).toBeDefined();
      expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
      expect(RLonDRSlideText).toBeDefined();
      expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
      expect(RLonDRSlideSubStep0?.childElementCount).toBeDefined();
    });

    it('should render the RL on DR slide substep 1', () => {
      render(<RLonDRSlide subStep={1} />);
      const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
      const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
      const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
      const RLonDRSlideSubStep1 = screen.queryByTestId('rlOnDRSlide-subStep1');

      expect(RLonDRSlideContainer).toBeDefined();
      expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
      expect(RLonDRSlideContent).toBeDefined();
      expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
      expect(RLonDRSlideText).toBeDefined();
      expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
      expect(RLonDRSlideSubStep1?.childElementCount).toBeDefined();
    });

    it('should render the RL on DR slide substep 2', () => {
      render(<RLonDRSlide subStep={2} />);
      const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
      const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
      const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
      const RLonDRSlideSubStep2 = screen.queryByTestId('rlOnDRSlide-subStep2');

      expect(RLonDRSlideContainer).toBeDefined();
      expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
      expect(RLonDRSlideContent).toBeDefined();
      expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
      expect(RLonDRSlideText).toBeDefined();
      expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
      expect(RLonDRSlideSubStep2?.childElementCount).toBeDefined();
    });

    it('should render the RL on DR slide substep 3', () => {
      render(<RLonDRSlide subStep={3} />);
      const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
      const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
      const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
      const RLonDRSlideSubStep3 = screen.queryByTestId('rlOnDRSlide-subStep3');

      expect(RLonDRSlideContainer).toBeDefined();
      expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
      expect(RLonDRSlideContent).toBeDefined();
      expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
      expect(RLonDRSlideText).toBeDefined();
      expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
      expect(RLonDRSlideSubStep3?.childElementCount).toBeDefined();
    });

    it('should render the RL on DR slide substep 4', () => {
      render(<RLonDRSlide subStep={4} />);
      const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
      const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
      const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
      const RLonDRSlideSubStep4 = screen.queryByTestId('rlOnDRSlide-subStep4');

      expect(RLonDRSlideContainer).toBeDefined();
      expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
      expect(RLonDRSlideContent).toBeDefined();
      expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
      expect(RLonDRSlideText).toBeDefined();
      expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
      expect(RLonDRSlideSubStep4?.childElementCount).toBeDefined();
    });

    it('should render the RL on DR slide substep 5', () => {
      render(<RLonDRSlide subStep={5} />);
      const RLonDRSlideContainer = screen.queryByTestId('rlOnDRSlideContainer');
      const RLonDRSlideContent = screen.queryByTestId('rlOnDRSlideContent');
      const RLonDRSlideText = screen.queryByTestId('rlOnDRSlideText');
      const RLonDRSlideSubStep5 = screen.queryByTestId('rlOnDRSlide-subStep5');

      expect(RLonDRSlideContainer).toBeDefined();
      expect(RLonDRSlideContainer?.className).toBe('rlOnDrSlideContainer');
      expect(RLonDRSlideContent).toBeDefined();
      expect(RLonDRSlideContent?.className).toBe('rlOnDrSlideContent');
      expect(RLonDRSlideText).toBeDefined();
      expect(RLonDRSlideText?.className).toBe('rlOnDrSlideText');
      expect(RLonDRSlideSubStep5?.childElementCount).toBeDefined();
    });
  });
});
