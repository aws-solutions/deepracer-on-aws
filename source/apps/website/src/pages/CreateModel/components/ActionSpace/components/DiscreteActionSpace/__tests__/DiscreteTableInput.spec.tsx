// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IndexedDiscreteActionSpaceItem } from '#pages/CreateModel/components/ActionSpace/components/DiscreteActionSpace/types';
import { DiscreteActionValueType } from '#pages/CreateModel/components/ActionSpace/constants';

import DiscreteTableInput from '../DiscreteTableInput';

interface TestDiscreteTableProps {
  ariaLabelledby?: string;
  graphId: number;
  valueType: DiscreteActionValueType;
  min: number;
  max: number;
  isEnabledAction: boolean;
  defaultValue: number;
  action: IndexedDiscreteActionSpaceItem | null | undefined;
  isFocused: boolean;
  updateActionSpaceItem: (graphID: number, valueType: string, value: number) => void;
  onFocusChange: (graphId: number, valueType: DiscreteActionValueType, focused: boolean) => void;
}

const arePropsEqual = (
  DiscreteTableInput as React.MemoExoticComponent<React.ComponentType<TestDiscreteTableProps>> & {
    compare: (prevProps: TestDiscreteTableProps, nextProps: TestDiscreteTableProps) => boolean;
  }
).compare;

describe('DiscreteTableInput - arePropsEqual', () => {
  const baseAction: IndexedDiscreteActionSpaceItem = {
    index: 0,
    steeringAngle: 15.5,
    speed: 2.5,
  };

  const baseProps: TestDiscreteTableProps = {
    graphId: 1,
    valueType: DiscreteActionValueType.SPEED,
    min: 0.1,
    max: 4.0,
    isEnabledAction: true,
    defaultValue: 2.0,
    action: baseAction,
    isFocused: false,
    updateActionSpaceItem: vi.fn(),
    onFocusChange: vi.fn(),
  };

  describe('Props equality comparison', () => {
    it('should return true when all relevant props are equal', () => {
      const prevProps = { ...baseProps };
      const nextProps = { ...baseProps };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should return true when only non-relevant props differ', () => {
      const prevProps = { ...baseProps, graphId: 1, min: 0.1, max: 4.0 };
      const nextProps = { ...baseProps, graphId: 2, min: 0.2, max: 5.0 };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });
  });
});

describe('DiscreteTableInput Component', () => {
  interface ComponentTestProps {
    ariaLabelledby?: string;
    graphId: number;
    valueType: DiscreteActionValueType;
    min: number;
    max: number;
    isEnabledAction: boolean;
    defaultValue: number;
    action: IndexedDiscreteActionSpaceItem;
    isFocused: boolean;
    updateActionSpaceItem: (graphID: number, valueType: string, value: number) => void;
    onFocusChange: (graphId: number, valueType: DiscreteActionValueType, focused: boolean) => void;
  }

  const componentBaseAction: IndexedDiscreteActionSpaceItem = {
    index: 0,
    steeringAngle: 15.5,
    speed: 2.5,
  };

  const defaultComponentProps: ComponentTestProps = {
    graphId: 1,
    valueType: DiscreteActionValueType.SPEED,
    min: 0.1,
    max: 4.0,
    isEnabledAction: true,
    defaultValue: 2.0,
    action: componentBaseAction,
    isFocused: false,
    updateActionSpaceItem: vi.fn(),
    onFocusChange: vi.fn(),
    ariaLabelledby: 'test-label',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render input with correct value for speed', () => {
      render(<DiscreteTableInput {...defaultComponentProps} />);

      const input = screen.getByDisplayValue('2.5');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('id', 'input_speed_1');
    });

    it('should render input with correct value for steering angle', () => {
      const props = {
        ...defaultComponentProps,
        valueType: DiscreteActionValueType.STEERING_ANGLE,
      };
      render(<DiscreteTableInput {...props} />);

      const input = screen.getByDisplayValue('15.5');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'input_angle_1');
    });

    it('should render with aria-labelledby attribute', () => {
      render(<DiscreteTableInput {...defaultComponentProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-labelledby', 'test-label');
    });

    it('should render without aria-labelledby when not provided', () => {
      const props = { ...defaultComponentProps, ariaLabelledby: undefined };
      render(<DiscreteTableInput {...props} />);

      const input = screen.getByRole('spinbutton');
      expect(input).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('Focus and Blur behavior', () => {
    it('should call onFocusChange with true when input is focused', () => {
      const onFocusChange = vi.fn();
      const props = { ...defaultComponentProps, onFocusChange };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.focus(input);

      expect(onFocusChange).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, true);
    });

    it('should call onFocusChange with false when input is blurred', () => {
      const onFocusChange = vi.fn();
      const props = { ...defaultComponentProps, onFocusChange };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.blur(input);

      expect(onFocusChange).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, false);
    });

    it('should show input value when focused', () => {
      const props = { ...defaultComponentProps, isFocused: false };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton') as HTMLInputElement;

      // Focus the input to trigger the onFocus handler
      fireEvent.focus(input);

      expect(input.value).toBe('2.5');
    });

    it('should show action value when not focused', () => {
      const props = { ...defaultComponentProps, isFocused: false };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton') as HTMLInputElement;

      expect(input.value).toBe('2.5');
    });
  });

  describe('Input validation and updates', () => {
    it('should call updateActionSpaceItem with valid speed input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '3.25' } });

      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 3.25);
    });

    it('should call updateActionSpaceItem with valid steering angle input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = {
        ...defaultComponentProps,
        valueType: DiscreteActionValueType.STEERING_ANGLE,
        min: -30,
        max: 30,
        updateActionSpaceItem,
        isFocused: true,
      };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '12.34' } });

      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.STEERING_ANGLE, 12.3);
    });

    it('should round speed values to 2 decimal places', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '3.256789' } });

      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 3.26);
    });

    it('should round steering angle values to 1 decimal place', () => {
      const updateActionSpaceItem = vi.fn();
      const props = {
        ...defaultComponentProps,
        valueType: DiscreteActionValueType.STEERING_ANGLE,
        min: -30,
        max: 30,
        updateActionSpaceItem,
        isFocused: true,
      };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '12.789' } });

      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.STEERING_ANGLE, 12.8);
    });

    it('should not call updateActionSpaceItem with invalid input (below min)', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true, min: 1.0 };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '0.5' } });

      expect(updateActionSpaceItem).not.toHaveBeenCalled();
    });

    it('should not call updateActionSpaceItem with invalid input (above max)', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true, max: 3.0 };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '5.0' } });

      expect(updateActionSpaceItem).not.toHaveBeenCalled();
    });

    it('should not call updateActionSpaceItem with non-numeric input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: 'invalid' } });

      expect(updateActionSpaceItem).not.toHaveBeenCalled();
    });

    it('should not call updateActionSpaceItem with empty input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '' } });

      expect(updateActionSpaceItem).not.toHaveBeenCalled();
    });
  });

  describe('Invalid state handling', () => {
    it('should not call updateActionSpaceItem when focused with invalid input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: 'invalid' } });

      // Should not call updateActionSpaceItem with invalid input
      expect(updateActionSpaceItem).not.toHaveBeenCalled();
    });

    it('should call updateActionSpaceItem when not focused with valid input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '2.5' } });

      // Should call updateActionSpaceItem with valid input
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 2.5);
    });

    it('should handle focus clearing invalid state behavior', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      // First make it invalid
      fireEvent.change(input, { target: { value: 'invalid' } });
      expect(updateActionSpaceItem).not.toHaveBeenCalled();

      // Then focus should allow for new input attempts
      fireEvent.focus(input);

      // Now try a valid input
      fireEvent.change(input, { target: { value: '1.5' } });
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 1.5);
    });

    it('should handle clearing invalid state with valid input', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      // First make it invalid
      fireEvent.change(input, { target: { value: 'invalid' } });
      expect(updateActionSpaceItem).not.toHaveBeenCalled();

      // Then valid input should work
      fireEvent.change(input, { target: { value: '2.0' } });
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 2.0);
    });

    it('should clear invalid state when input becomes empty', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton') as HTMLInputElement;

      // First make it invalid
      fireEvent.change(input, { target: { value: 'invalid' } });
      expect(updateActionSpaceItem).not.toHaveBeenCalled();

      // Then clear the input (empty string)
      fireEvent.change(input, { target: { value: '' } });

      // The input should accept valid input after being cleared
      fireEvent.change(input, { target: { value: '2.0' } });
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 2.0);
    });

    it('should not call updateActionSpaceItem for empty input during typing', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      // Clear the input
      fireEvent.change(input, { target: { value: '' } });
      // Should not call updateActionSpaceItem for empty input
      expect(updateActionSpaceItem).not.toHaveBeenCalled();
      // Input should accept valid input after being empty
      fireEvent.change(input, { target: { value: '1.5' } });
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 1.5);
    });

    it('should clear invalid state specifically when transitioning from invalid to empty', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      // Start with valid input
      fireEvent.change(input, { target: { value: '2.0' } });
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 2.0);
      // Make invalid
      fireEvent.change(input, { target: { value: 'abc' } });
      expect(updateActionSpaceItem).toHaveBeenCalledTimes(1); // Should not be called again
      // Clear to empty
      fireEvent.change(input, { target: { value: '' } });
      expect(updateActionSpaceItem).toHaveBeenCalledTimes(1); // Still should not be called
      // Now valid input should work again
      fireEvent.change(input, { target: { value: '3.0' } });
      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 3.0);
      expect(updateActionSpaceItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle action with zero values', () => {
      const actionWithZeros = { ...componentBaseAction, speed: 0, steeringAngle: 0 };
      const props = { ...defaultComponentProps, action: actionWithZeros };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByDisplayValue('0');
      expect(input).toBeInTheDocument();
    });

    it('should handle action with negative values', () => {
      const actionWithNegatives = { ...componentBaseAction, speed: -1.5, steeringAngle: -10.0 };
      const props = { ...defaultComponentProps, action: actionWithNegatives };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByDisplayValue('-1.5');
      expect(input).toBeInTheDocument();
    });

    it('should handle boundary min value', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true, min: 1.0 };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '1.0' } });

      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 1.0);
    });

    it('should handle boundary max value', () => {
      const updateActionSpaceItem = vi.fn();
      const props = { ...defaultComponentProps, updateActionSpaceItem, isFocused: true, max: 3.0 };

      render(<DiscreteTableInput {...props} />);
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '3.0' } });

      expect(updateActionSpaceItem).toHaveBeenCalledWith(1, DiscreteActionValueType.SPEED, 3.0);
    });
  });
});

describe('DiscreteTableInput - arePropsEqual Additional Tests', () => {
  const baseAction: IndexedDiscreteActionSpaceItem = {
    index: 0,
    steeringAngle: 15.5,
    speed: 2.5,
  };

  const baseProps: TestDiscreteTableProps = {
    graphId: 1,
    valueType: DiscreteActionValueType.SPEED,
    min: 0.1,
    max: 4.0,
    isEnabledAction: true,
    defaultValue: 2.0,
    action: baseAction,
    isFocused: false,
    updateActionSpaceItem: vi.fn(),
    onFocusChange: vi.fn(),
  };

  describe('Action steeringAngle comparison', () => {
    it('should return false when action.steeringAngle differs', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 20.0 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should return true when action.steeringAngle is the same with different precision', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.0 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should return false when action.steeringAngle differs by small amount', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.1 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });
  });

  describe('Action speed comparison', () => {
    it('should return false when action.speed differs', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, speed: 2.0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, speed: 3.0 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should return true when action.speed is exactly the same', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, speed: 2.5 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, speed: 2.5 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should return false when action.speed differs by small amount', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, speed: 2.5 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, speed: 2.51 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });
  });

  describe('isFocused comparison', () => {
    it('should return false when isFocused differs', () => {
      const prevProps = { ...baseProps, isFocused: false };
      const nextProps = { ...baseProps, isFocused: true };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should return true when isFocused is the same', () => {
      const prevProps = { ...baseProps, isFocused: true };
      const nextProps = { ...baseProps, isFocused: true };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });
  });

  describe('isEnabledAction comparison', () => {
    it('should return false when isEnabledAction differs', () => {
      const prevProps = { ...baseProps, isEnabledAction: false };
      const nextProps = { ...baseProps, isEnabledAction: true };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should return true when isEnabledAction is the same', () => {
      const prevProps = { ...baseProps, isEnabledAction: true };
      const nextProps = { ...baseProps, isEnabledAction: true };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });
  });

  describe('Action nullability and edge cases', () => {
    it('should handle null action objects', () => {
      const prevProps = { ...baseProps, action: null as null };
      const nextProps = { ...baseProps, action: null as null };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should handle undefined action objects', () => {
      const prevProps = { ...baseProps, action: undefined as undefined };
      const nextProps = { ...baseProps, action: undefined as undefined };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should return false when one action is null and other is defined', () => {
      const prevProps = { ...baseProps, action: null as null };
      const nextProps = { ...baseProps, action: baseAction };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should return false when one action is undefined and other is defined', () => {
      const prevProps = { ...baseProps, action: undefined as undefined };
      const nextProps = { ...baseProps, action: baseAction };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should handle action with missing properties', () => {
      const incompleteAction = { index: 0, steeringAngle: 15.0 } as IndexedDiscreteActionSpaceItem;
      const prevProps = { ...baseProps, action: incompleteAction };
      const nextProps = { ...baseProps, action: incompleteAction };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });
  });

  describe('Multiple prop differences', () => {
    it('should return false when multiple relevant props differ', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 10.0, speed: 1.5 },
        isFocused: false,
        isEnabledAction: false,
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 20.0, speed: 2.5 },
        isFocused: true,
        isEnabledAction: true,
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });

    it('should return false when any single relevant prop differs even if others are same', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.0, speed: 2.5 },
        isFocused: true,
        isEnabledAction: true,
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 15.0, speed: 2.5 },
        isFocused: false, // Only this differs
        isEnabledAction: true,
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(false);
    });
  });

  describe('Numeric precision and type handling', () => {
    it('should handle zero values correctly', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 0, speed: 0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 0, speed: 0 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should handle negative values correctly', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: -15.5, speed: 1.0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: -15.5, speed: 1.0 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });

    it('should distinguish between positive and negative zero', () => {
      const prevProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: 0, speed: 2.0 },
      };
      const nextProps = {
        ...baseProps,
        action: { ...baseAction, steeringAngle: -0, speed: 2.0 },
      };

      const result = arePropsEqual(prevProps, nextProps);

      expect(result).toBe(true);
    });
  });

  describe('Component integration with memo', () => {
    it('should be used correctly with React.memo', () => {
      const memoizedComponent = DiscreteTableInput as React.MemoExoticComponent<
        React.ComponentType<TestDiscreteTableProps>
      >;
      const isMemorized =
        DiscreteTableInput.displayName?.includes('memo') ||
        (memoizedComponent as { $$typeof?: symbol }).$$typeof?.toString().includes('react.memo');

      expect(isMemorized).toBe(true);
    });

    it('should have the comparison function attached', () => {
      const memoizedComponent = DiscreteTableInput as React.MemoExoticComponent<
        React.ComponentType<TestDiscreteTableProps>
      > & {
        compare?: (prevProps: TestDiscreteTableProps, nextProps: TestDiscreteTableProps) => boolean;
      };
      expect(memoizedComponent.compare).toBeDefined();
    });
  });
});
