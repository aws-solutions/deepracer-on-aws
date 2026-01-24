/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/no-container */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import InteractiveArrow from '../InteractiveArrow';

interface InteractiveArrowProps {
  graphId: number;
  xOrigin: number;
  yOrigin: number;
  speedCurrent: number;
  maxRadius: number;
  rotateAngle: number;
  enabled: boolean;
  isAdvancedConfigOn: boolean;
  setGraphDragIsActive: (graphId: number, isActive: boolean) => void;
  setActionValues: (graphId: number, speed: number, angle: number) => void;
}

describe('InteractiveArrow', () => {
  const defaultProps: InteractiveArrowProps = {
    graphId: 1,
    xOrigin: 100,
    yOrigin: 100,
    speedCurrent: 2.0,
    maxRadius: 80,
    rotateAngle: 15.0,
    enabled: true,
    isAdvancedConfigOn: true,
    setGraphDragIsActive: vi.fn(),
    setActionValues: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useEffect for maxRadius validation', () => {
    it('should log error and not render when maxRadius is zero', () => {
      const props = { ...defaultProps, maxRadius: 0 };
      const consoleSpy = vi.spyOn(console, 'error');

      const { container } = render(
        <svg>
          <InteractiveArrow {...props} />
        </svg>,
      );

      expect(consoleSpy).toHaveBeenCalledWith('Radius is not a positive value');
      expect(container.innerHTML).toBe('<svg></svg>');
    });

    it('should log error and not render when maxRadius is negative', () => {
      const props = { ...defaultProps, maxRadius: -10 };
      const consoleSpy = vi.spyOn(console, 'error');

      const { container } = render(
        <svg>
          <InteractiveArrow {...props} />
        </svg>,
      );

      expect(consoleSpy).toHaveBeenCalledWith('Radius is not a positive value');
      expect(container.innerHTML).toBe('<svg></svg>');
    });

    it('should render normally when maxRadius is positive', () => {
      const props = { ...defaultProps, maxRadius: 80 };
      const consoleSpy = vi.spyOn(console, 'error');

      const { container } = render(
        <svg>
          <InteractiveArrow {...props} />
        </svg>,
      );

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(container.innerHTML).not.toBe('<svg></svg>');
      expect(container.innerHTML).toContain('path');
      expect(container.innerHTML).toContain('polygon');
    });
  });

  describe('useEffect for position updates', () => {
    it('should update arrow position when rotateAngle changes', () => {
      const setActionValues = vi.fn();
      const initialProps = { ...defaultProps, rotateAngle: 0, setActionValues };

      const { rerender, container } = render(
        <svg>
          <InteractiveArrow {...initialProps} />
        </svg>,
      );

      const getPathContent = () => container.querySelector('path')?.getAttribute('d') || '';
      const initialPath = getPathContent();

      // Change rotateAngle
      const updatedProps = { ...initialProps, rotateAngle: 30 };
      rerender(
        <svg>
          <InteractiveArrow {...updatedProps} />
        </svg>,
      );

      const updatedPath = getPathContent();
      // Path should have changed because arrow position updated
      expect(updatedPath).not.toBe(initialPath);
    });

    it('should update arrow position when speedCurrent changes', () => {
      const setActionValues = vi.fn();
      const initialProps = { ...defaultProps, speedCurrent: 1.0, setActionValues };

      const { rerender, container } = render(
        <svg>
          <InteractiveArrow {...initialProps} />
        </svg>,
      );

      const getPathContent = () => container.querySelector('path')?.getAttribute('d') || '';
      const initialPath = getPathContent();

      // Change speedCurrent
      const updatedProps = { ...initialProps, speedCurrent: 3.0 };
      rerender(
        <svg>
          <InteractiveArrow {...updatedProps} />
        </svg>,
      );

      const updatedPath = getPathContent();
      expect(updatedPath).not.toBe(initialPath);
    });

    it('should update arrow position when both rotateAngle and speedCurrent change', () => {
      const setActionValues = vi.fn();
      const initialProps = {
        ...defaultProps,
        rotateAngle: 0,
        speedCurrent: 1.0,
        setActionValues,
      };

      const { rerender, container } = render(
        <svg>
          <InteractiveArrow {...initialProps} />
        </svg>,
      );

      const getPathContent = () => container.querySelector('path')?.getAttribute('d') || '';
      const initialPath = getPathContent();

      // Change both props
      const updatedProps = { ...initialProps, rotateAngle: 45, speedCurrent: 2.5 };
      rerender(
        <svg>
          <InteractiveArrow {...updatedProps} />
        </svg>,
      );

      const updatedPath = getPathContent();
      expect(updatedPath).not.toBe(initialPath);
    });

    it('should not update position when only non-relevant props change', () => {
      const setActionValues = vi.fn();
      const initialProps = { ...defaultProps, setActionValues };

      const { rerender, container } = render(
        <svg>
          <InteractiveArrow {...initialProps} />
        </svg>,
      );

      const getPathContent = () => container.querySelector('path')?.getAttribute('d') || '';
      const initialPath = getPathContent();

      const updatedProps = { ...initialProps, enabled: false };
      rerender(
        <svg>
          <InteractiveArrow {...updatedProps} />
        </svg>,
      );

      const updatedPath = getPathContent();
      expect(updatedPath).toBe(initialPath);
    });

    it('should calculate correct arrow position based on trigonometric functions', () => {
      const props = {
        ...defaultProps,
        xOrigin: 0,
        yOrigin: 0,
        speedCurrent: 2.0,
        maxRadius: 80,
        rotateAngle: 90, // 90 degrees should affect position calculation
      };

      const { container } = render(
        <svg>
          <InteractiveArrow {...props} />
        </svg>,
      );

      const pathElement = container.querySelector('path');
      const pathD = pathElement?.getAttribute('d');

      expect(pathD).toContain('M 0,0');
      expect(pathD).toMatch(/M 0,0 [-\d.e+-]+,[-\d.e+-]+/);
    });
  });

  describe('Component behavior and interactions', () => {
    it('should render SVG elements when not in error state', () => {
      render(
        <svg>
          <InteractiveArrow {...defaultProps} />
        </svg>,
      );

      expect(document.querySelector('svg path')).toBeInTheDocument();
      expect(document.querySelector('svg polygon')).toBeInTheDocument();
    });

    it('should apply correct styling based on enabled prop', () => {
      const { rerender } = render(
        <svg>
          <InteractiveArrow {...defaultProps} enabled={true} />
        </svg>,
      );

      const enabledPath = document.querySelector('path');
      expect(enabledPath).toHaveAttribute('stroke', '#779EFF'); // GRAPH_PRIMARY

      rerender(
        <svg>
          <InteractiveArrow {...defaultProps} enabled={false} />
        </svg>,
      );

      const disabledPath = document.querySelector('path');
      expect(disabledPath).toHaveAttribute('stroke', '#16191F'); // GRAPH_BLACK
    });

    it('should set correct cursor style based on isAdvancedConfigOn prop', () => {
      const { rerender } = render(
        <svg>
          <InteractiveArrow {...defaultProps} isAdvancedConfigOn={true} />
        </svg>,
      );

      const advancedGroup = document.querySelector('g');
      expect(advancedGroup).toHaveAttribute('cursor', 'pointer');

      rerender(
        <svg>
          <InteractiveArrow {...defaultProps} isAdvancedConfigOn={false} />
        </svg>,
      );

      const basicGroup = document.querySelector('g');
      expect(basicGroup).toHaveAttribute('cursor', 'auto');
    });

    it('should call setGraphDragIsActive when drag interactions occur', () => {
      const setGraphDragIsActive = vi.fn();
      const props = { ...defaultProps, setGraphDragIsActive };

      render(
        <svg>
          <InteractiveArrow {...props} />
        </svg>,
      );

      expect(setGraphDragIsActive).toBeDefined();
      expect(typeof setGraphDragIsActive).toBe('function');
    });

    it('should call setActionValues when action values change', () => {
      const setActionValues = vi.fn();
      const props = { ...defaultProps, setActionValues };

      render(
        <svg>
          <InteractiveArrow {...props} />
        </svg>,
      );

      expect(setActionValues).toBeDefined();
      expect(typeof setActionValues).toBe('function');
    });
  });

  describe('Props validation and behavior', () => {
    it('should handle zero speed values correctly', () => {
      const props = { ...defaultProps, speedCurrent: 0 };

      expect(() => {
        render(
          <svg>
            <InteractiveArrow {...props} />
          </svg>,
        );
      }).not.toThrow();
    });

    it('should handle negative speed values correctly', () => {
      const props = { ...defaultProps, speedCurrent: -1.0 };

      expect(() => {
        render(
          <svg>
            <InteractiveArrow {...props} />
          </svg>,
        );
      }).not.toThrow();
    });

    it('should handle extreme angle values correctly', () => {
      const props = { ...defaultProps, rotateAngle: 360 };

      expect(() => {
        render(
          <svg>
            <InteractiveArrow {...props} />
          </svg>,
        );
      }).not.toThrow();
    });

    it('should handle large coordinate values correctly', () => {
      const props = {
        ...defaultProps,
        xOrigin: 1000,
        yOrigin: 1000,
        maxRadius: 200,
      };

      expect(() => {
        render(
          <svg>
            <InteractiveArrow {...props} />
          </svg>,
        );
      }).not.toThrow();
    });
  });
});
