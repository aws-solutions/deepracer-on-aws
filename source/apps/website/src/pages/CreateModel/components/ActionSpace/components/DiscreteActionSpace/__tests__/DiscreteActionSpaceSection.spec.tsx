// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { DiscreteActionValueType } from '#pages/CreateModel/components/ActionSpace/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';
import { render, screen } from '#utils/testUtils';

import DiscreteActionSpaceSection from '../DiscreteActionSpaceSection';

vi.mock('#assets/images/carGraph.png', () => ({
  default: 'mocked-car-graph.png',
}));

vi.mock('../InteractiveArrow', () => ({
  default: ({ graphId }: { graphId: number }) => (
    <div data-testid={`interactive-arrow-${graphId}`}>InteractiveArrow</div>
  ),
}));

vi.mock('../DiscreteTableInput', () => ({
  default: ({
    graphId,
    valueType,
    onFocusChange,
    isFocused,
  }: {
    graphId: number;
    valueType: DiscreteActionValueType;
    onFocusChange: (graphId: number, valueType: DiscreteActionValueType, focused: boolean) => void;
    isFocused: boolean;
  }) => (
    <div data-testid={`table-input-${graphId}-${valueType}`}>
      <input
        data-testid={`input-${graphId}-${valueType}`}
        data-is-focused={isFocused}
        onFocus={() => onFocusChange(graphId, valueType, true)}
        onBlur={() => onFocusChange(graphId, valueType, false)}
      />
    </div>
  ),
}));

const TestComponent = ({ overrideProps = {} }: { overrideProps?: Partial<CreateModelFormValues> }) => {
  const methods = useForm<CreateModelFormValues>({
    defaultValues: {
      actionSpaceForm: {
        isAdvancedConfigOn: true,
        maxSpeed: 2.0,
        maxSteeringAngle: 15,
        speedGranularity: 2,
        steeringAngleGranularity: 5,
      },
      metadata: {
        actionSpace: {
          discrete: [
            { steeringAngle: -15, speed: 1.0 },
            { steeringAngle: 0, speed: 1.5 },
            { steeringAngle: 15, speed: 2.0 },
          ],
        },
      },
      preTrainedModelId: undefined,
      ...overrideProps,
    },
  });

  return (
    <DiscreteActionSpaceSection control={methods.control} setValue={methods.setValue} resetField={methods.resetField} />
  );
};

describe('DiscreteActionSpaceSection - handleFocusChange', () => {
  const renderComponent = (props = {}) => {
    return render(<TestComponent overrideProps={props} />);
  };

  describe('Focus state management', () => {
    it('should add focus state when steering angle input is focused', async () => {
      renderComponent();

      const steeringInput = screen.getByTestId('input-0-angle');

      // Initially not focused
      expect(steeringInput).toHaveAttribute('data-is-focused', 'false');

      // Focus the input
      fireEvent.focus(steeringInput);

      // Should now be focused
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');
    });

    it('should add focus state when speed input is focused', async () => {
      renderComponent();

      const speedInput = screen.getByTestId('input-0-speed');

      // Initially not focused
      expect(speedInput).toHaveAttribute('data-is-focused', 'false');

      // Focus the input
      fireEvent.focus(speedInput);

      // Should be focused
      expect(speedInput).toHaveAttribute('data-is-focused', 'true');
    });

    it('should remove focus state when steering angle input is blurred', async () => {
      renderComponent();

      const steeringInput = screen.getByTestId('input-0-angle');

      // Focus then blur the input
      fireEvent.focus(steeringInput);
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');

      fireEvent.blur(steeringInput);
      expect(steeringInput).toHaveAttribute('data-is-focused', 'false');
    });

    it('should remove focus state when speed input is blurred', async () => {
      renderComponent();

      const speedInput = screen.getByTestId('input-0-speed');

      // Focus then blur the input
      fireEvent.focus(speedInput);
      expect(speedInput).toHaveAttribute('data-is-focused', 'true');

      fireEvent.blur(speedInput);
      expect(speedInput).toHaveAttribute('data-is-focused', 'false');
    });

    it('should handle multiple inputs focused simultaneously', async () => {
      renderComponent();

      const steeringInput0 = screen.getByTestId('input-0-angle');
      const speedInput0 = screen.getByTestId('input-0-speed');
      const steeringInput1 = screen.getByTestId('input-1-angle');

      // Focus multiple inputs
      fireEvent.focus(steeringInput0);
      fireEvent.focus(speedInput0);
      fireEvent.focus(steeringInput1);

      // All should be focused
      expect(steeringInput0).toHaveAttribute('data-is-focused', 'true');
      expect(speedInput0).toHaveAttribute('data-is-focused', 'true');
      expect(steeringInput1).toHaveAttribute('data-is-focused', 'true');

      // Blur one input
      fireEvent.blur(speedInput0);

      // Only that input should lose focus
      expect(steeringInput0).toHaveAttribute('data-is-focused', 'true');
      expect(speedInput0).toHaveAttribute('data-is-focused', 'false');
      expect(steeringInput1).toHaveAttribute('data-is-focused', 'true');
    });

    it('should handle focus state for different action indices', async () => {
      renderComponent();

      const steeringInput0 = screen.getByTestId('input-0-angle');
      const steeringInput1 = screen.getByTestId('input-1-angle');
      const steeringInput2 = screen.getByTestId('input-2-angle');

      // Focus inputs with different graphIds
      fireEvent.focus(steeringInput0);
      fireEvent.focus(steeringInput2);

      // Only focused inputs should have focus state
      expect(steeringInput0).toHaveAttribute('data-is-focused', 'true');
      expect(steeringInput1).toHaveAttribute('data-is-focused', 'false');
      expect(steeringInput2).toHaveAttribute('data-is-focused', 'true');
    });

    it('should distinguish between steering angle and speed inputs for the same action', async () => {
      renderComponent();

      const steeringInput = screen.getByTestId('input-1-angle');
      const speedInput = screen.getByTestId('input-1-speed');

      // Focus steering input only
      fireEvent.focus(steeringInput);

      // Only steering input should be focused
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');
      expect(speedInput).toHaveAttribute('data-is-focused', 'false');

      // Focus speed input
      fireEvent.focus(speedInput);

      // Both should be focused
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');
      expect(speedInput).toHaveAttribute('data-is-focused', 'true');

      // Blur steering input
      fireEvent.blur(steeringInput);

      // Only speed input should remain focused
      expect(steeringInput).toHaveAttribute('data-is-focused', 'false');
      expect(speedInput).toHaveAttribute('data-is-focused', 'true');
    });

    it('should properly generate unique focus keys for different combinations', async () => {
      renderComponent();

      // Test that different combinations of graphId and valueType create unique focus states
      const inputs = [
        screen.getByTestId('input-0-angle'),
        screen.getByTestId('input-0-speed'),
        screen.getByTestId('input-1-angle'),
        screen.getByTestId('input-1-speed'),
        screen.getByTestId('input-2-angle'),
        screen.getByTestId('input-2-speed'),
      ];

      // Focus all inputs
      inputs.forEach((input) => fireEvent.focus(input));

      // All should be focused independently
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('data-is-focused', 'true');
      });

      // Blur odd-indexed inputs
      [inputs[1], inputs[3], inputs[5]].forEach((input) => fireEvent.blur(input));

      // Only even-indexed inputs should remain focused
      expect(inputs[0]).toHaveAttribute('data-is-focused', 'true');
      expect(inputs[1]).toHaveAttribute('data-is-focused', 'false');
      expect(inputs[2]).toHaveAttribute('data-is-focused', 'true');
      expect(inputs[3]).toHaveAttribute('data-is-focused', 'false');
      expect(inputs[4]).toHaveAttribute('data-is-focused', 'true');
      expect(inputs[5]).toHaveAttribute('data-is-focused', 'false');
    });
  });

  describe('Integration with DiscreteTableInput', () => {
    it('should pass correct isFocused prop to DiscreteTableInput components', async () => {
      renderComponent();

      // Verify all table inputs are rendered
      expect(screen.getByTestId('table-input-0-angle')).toBeInTheDocument();
      expect(screen.getByTestId('table-input-0-speed')).toBeInTheDocument();
      expect(screen.getByTestId('table-input-1-angle')).toBeInTheDocument();
      expect(screen.getByTestId('table-input-1-speed')).toBeInTheDocument();
      expect(screen.getByTestId('table-input-2-angle')).toBeInTheDocument();
      expect(screen.getByTestId('table-input-2-speed')).toBeInTheDocument();

      // Initially all inputs should not be focused
      expect(screen.getByTestId('input-0-angle')).toHaveAttribute('data-is-focused', 'false');
      expect(screen.getByTestId('input-0-speed')).toHaveAttribute('data-is-focused', 'false');
    });

    it('should update isFocused prop when focus state changes', async () => {
      renderComponent();

      const steeringInput = screen.getByTestId('input-1-angle');

      // Focus the input
      fireEvent.focus(steeringInput);

      // Should receive updated isFocused prop
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');

      // Blur the input
      fireEvent.blur(steeringInput);

      // Should receive updated isFocused prop
      expect(steeringInput).toHaveAttribute('data-is-focused', 'false');
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid focus/blur events', async () => {
      renderComponent();

      const steeringInput = screen.getByTestId('input-0-angle');

      // Rapid focus/blur cycles
      for (let i = 0; i < 5; i++) {
        fireEvent.focus(steeringInput);
        expect(steeringInput).toHaveAttribute('data-is-focused', 'true');
        fireEvent.blur(steeringInput);
        expect(steeringInput).toHaveAttribute('data-is-focused', 'false');
      }
    });

    it('should maintain focus state when component re-renders', async () => {
      const { rerender } = renderComponent();

      const steeringInput = screen.getByTestId('input-0-angle');
      fireEvent.focus(steeringInput);
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');

      // Re-render component with same props
      rerender(<TestComponent overrideProps={{}} />);

      // Focus state should persist after re-render
      const newSteeringInput = screen.getByTestId('input-0-angle');
      expect(newSteeringInput).toHaveAttribute('data-is-focused', 'true');
    });

    it('should reset focus state when component is unmounted and remounted', async () => {
      const { unmount } = renderComponent();

      const steeringInput = screen.getByTestId('input-0-angle');
      fireEvent.focus(steeringInput);
      expect(steeringInput).toHaveAttribute('data-is-focused', 'true');

      // Unmount component
      unmount();

      // Re-mount component
      renderComponent();

      // Focus state should be reset after unmount/remount
      const newSteeringInput = screen.getByTestId('input-0-angle');
      expect(newSteeringInput).toHaveAttribute('data-is-focused', 'false');
    });
  });
});
