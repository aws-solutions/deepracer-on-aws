// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent } from '@testing-library/react';
import { ReactElement, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

import { transformToNumber } from '#utils/formUtils';

import InputField from '../InputField';
import type { InputFieldProps } from '../types';

vi.mock('#utils/formUtils', () => ({
  transformToNumber: vi.fn(),
}));

vi.mock('@cloudscape-design/components/form-field', () => ({
  default: ({
    children,
    label,
    description,
    errorText,
    constraintText,
    info,
    secondaryControl,
    stretch,
  }: React.PropsWithChildren<{
    label?: React.ReactNode;
    description?: React.ReactNode;
    errorText?: React.ReactNode;
    constraintText?: React.ReactNode;
    info?: React.ReactNode;
    secondaryControl?: React.ReactNode;
    stretch?: boolean;
  }>) => (
    <div data-testid="form-field">
      {label && <label>{label}</label>}
      {description && <div data-testid="description">{description}</div>}
      {errorText && <div data-testid="error-text">{errorText}</div>}
      {constraintText && <div data-testid="constraint-text">{constraintText}</div>}
      {info && <div data-testid="info">{info}</div>}
      {secondaryControl && <div data-testid="secondary-control">{secondaryControl}</div>}
      {stretch && <div data-testid="stretch">stretch</div>}
      {children}
    </div>
  ),
}));

vi.mock('@cloudscape-design/components/input', () => ({
  default: ({
    onChange,
    onBlur,
    value,
    disabled,
    name,
    type,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    onChange?: (event: { detail: { value: string } }) => void;
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
    value?: string | number;
    name?: string;
    type?: string;
    disabled?: boolean;
  }) => (
    <input
      data-testid="input"
      onChange={(e) => onChange?.({ detail: { value: e.target.value } })}
      onBlur={(e) => onBlur?.(e)}
      value={value || ''}
      disabled={disabled}
      name={name}
      type={type}
      {...props}
    />
  ),
}));

const TestWrapper = ({ children }: { children: ReactElement }) => {
  return <div>{children}</div>;
};

const createFormWithInputField = (props: Partial<InputFieldProps<{ testField: string }, 'testField'>> = {}) => {
  const TestForm = () => {
    const { control } = useForm({
      defaultValues: {
        testField: '',
      },
    });

    return (
      <TestWrapper>
        <InputField control={control} name="testField" label="Test Field" {...props} />
      </TestWrapper>
    );
  };

  return TestForm;
};

const createNumberFormWithInputField = (
  props: Partial<InputFieldProps<{ numberField: number }, 'numberField'>> = {},
) => {
  const TestForm = () => {
    const { control } = useForm({
      defaultValues: {
        numberField: 0,
      },
    });

    return (
      <TestWrapper>
        <InputField control={control} name="numberField" label="Number Field" type="number" {...props} />
      </TestWrapper>
    );
  };

  return TestForm;
};

describe('InputField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (transformToNumber as Mock).mockImplementation((value: string) => {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    });
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      const TestForm = createFormWithInputField();
      render(<TestForm />);

      expect(screen.getByTestId('form-field')).toBeInTheDocument();
      expect(screen.getByTestId('input')).toBeInTheDocument();
      expect(screen.getByText('Test Field')).toBeInTheDocument();
    });

    it('renders with all optional props', () => {
      const TestForm = createFormWithInputField({
        description: 'Test description',
        constraintText: 'Test constraint',
        info: 'Test info',
        secondaryControl: <button>Secondary</button>,
        stretch: true,
      });
      render(<TestForm />);

      expect(screen.getByTestId('description')).toHaveTextContent('Test description');
      expect(screen.getByTestId('constraint-text')).toHaveTextContent('Test constraint');
      expect(screen.getByTestId('info')).toHaveTextContent('Test info');
      expect(screen.getByTestId('secondary-control')).toBeInTheDocument();
      expect(screen.getByTestId('stretch')).toBeInTheDocument();
    });

    it('passes through input props', () => {
      const TestForm = createFormWithInputField({
        placeholder: 'Enter text',
        autoComplete: 'off',
      });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('placeholder', 'Enter text');
      expect(input).toHaveAttribute('autoComplete', 'off');
    });
  });

  describe('Text Input Behavior', () => {
    it('handles text input changes', () => {
      const onChange = vi.fn();
      const TestForm = createFormWithInputField({ onChange });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'test value' } });

      expect(onChange).toHaveBeenCalledWith({
        detail: { value: 'test value' },
      });
    });

    it('handles blur events', () => {
      const onBlur = vi.fn();
      const TestForm = createFormWithInputField({ onBlur });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalled();
    });

    it('handles text input with type="text"', () => {
      const TestForm = createFormWithInputField({ type: 'text' });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'text');
    });
  });

  describe('Number Input Behavior', () => {
    it('handles number input with type="number"', () => {
      const TestForm = createNumberFormWithInputField();
      render(<TestForm />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('filters and transforms numeric input for number type', () => {
      const onChange = vi.fn();
      const TestForm = createNumberFormWithInputField({ onChange });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: '123.45' } });

      expect(transformToNumber).toHaveBeenCalledWith('123.45');
      expect(onChange).toHaveBeenCalledWith({
        detail: { value: 123.45 },
      });
    });

    it('handles negative numbers correctly', () => {
      const TestForm = createNumberFormWithInputField();
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: '-123.45' } });

      expect(transformToNumber).toHaveBeenCalledWith('-123.45');
    });

    it('handles text type with numeric field value', () => {
      const TestForm = () => {
        const { control } = useForm({
          defaultValues: {
            numericTextField: 42,
          },
        });

        return (
          <TestWrapper>
            <InputField control={control} name="numericTextField" label="Numeric Text Field" type="text" />
          </TestWrapper>
        );
      };

      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: '123abc' } });

      expect(transformToNumber).toHaveBeenCalledWith('123');
    });
  });

  describe('Form Integration', () => {
    it('displays validation errors', () => {
      const TestForm = () => {
        const { control, setError } = useForm({
          defaultValues: { testField: '' },
        });

        useEffect(() => {
          setError('testField', { message: 'This field is required' });
        }, [setError]);

        return (
          <TestWrapper>
            <InputField control={control} name="testField" label="Test Field" />
          </TestWrapper>
        );
      };

      render(<TestForm />);
      expect(screen.getByTestId('error-text')).toHaveTextContent('This field is required');
    });

    it('handles disabled state', () => {
      const TestForm = createFormWithInputField({ disabled: true });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
    });

    it('handles shouldUnregister prop', () => {
      const TestForm = createFormWithInputField({ shouldUnregister: true });
      render(<TestForm />);

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('calls both field and custom onBlur handlers', () => {
      const customOnBlur = vi.fn();
      const TestForm = createFormWithInputField({ onBlur: customOnBlur });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.blur(input);

      expect(customOnBlur).toHaveBeenCalled();
    });

    it('calls both field and custom onChange handlers for text input', () => {
      const customOnChange = vi.fn();
      const TestForm = createFormWithInputField({ onChange: customOnChange });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'test' } });

      expect(customOnChange).toHaveBeenCalledWith({
        detail: { value: 'test' },
      });
    });

    it('calls custom onChange with transformed number for number input', () => {
      const customOnChange = vi.fn();
      const TestForm = createNumberFormWithInputField({ onChange: customOnChange });
      render(<TestForm />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: '123' } });

      expect(customOnChange).toHaveBeenCalledWith({
        detail: { value: 123 },
      });
    });
  });

  describe('Type Safety', () => {
    it('works with string field values', () => {
      const TestForm = createFormWithInputField();
      render(<TestForm />);

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('works with number field values', () => {
      const TestForm = createNumberFormWithInputField();
      render(<TestForm />);

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('handles undefined field values', () => {
      const TestForm = () => {
        const { control } = useForm({
          defaultValues: {
            undefinedField: '',
          },
        });

        return (
          <TestWrapper>
            <InputField control={control} name="undefinedField" label="Undefined Field" />
          </TestWrapper>
        );
      };

      render(<TestForm />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });
  });
});
