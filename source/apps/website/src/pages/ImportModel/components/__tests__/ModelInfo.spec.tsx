// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { render, screen } from '@testing-library/react';
import { Control } from 'react-hook-form';
import { vi } from 'vitest';

import { ImportModelFormValues } from '../../types';
import { ModelInfo } from '../ModelInfo';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'details.modelName.label': 'Model Name',
        'details.modelName.description': 'Enter a name for your model',
        'details.modelDescription.label': 'Model Description',
        'details.modelDescription.description': 'Enter a description for your model',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ModelInfo', () => {
  const createSubject = () => ({
    next: vi.fn(),
    subscribe: (callback: () => void) => ({
      unsubscribe: vi.fn(),
    }),
  });

  const mockControl = {
    register: vi.fn(),
    unregister: vi.fn(),
    getFieldState: vi.fn(),
    _formState: {},
    _names: { mount: new Set(), unMount: new Set(), array: new Set() },
    _subjects: {
      watch: createSubject(),
      array: createSubject(),
      state: createSubject(),
    },
    _getWatch: vi.fn(),
    _formValues: {},
    _defaultValues: {},
    _removeUnmounted: vi.fn(),
    _updateValid: vi.fn(),
    _updateFieldArray: vi.fn(),
    _getFieldArray: vi.fn(),
    _getDirty: vi.fn(),
    _updateDisabledField: vi.fn(),
    _proxyFormState: {},
    _options: {
      mode: 'onSubmit',
      reValidateMode: 'onChange',
      shouldFocusError: true,
    },
    field: {
      onChange: vi.fn(),
      onBlur: vi.fn(),
      value: '',
      ref: vi.fn(),
      name: 'modelName',
    },
  } as unknown as Control<ImportModelFormValues>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render model name input field', () => {
    render(<ModelInfo control={mockControl} />);
    expect(screen.getByTestId('model-name-input')).toBeInTheDocument();
  });

  it('should display error message when provided', () => {
    render(<ModelInfo control={mockControl} nameErrorText="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should render model description input field', () => {
    render(<ModelInfo control={mockControl} />);
    expect(screen.getByTestId('model-description-input')).toBeInTheDocument();
  });

  it('should handle empty/null values', () => {
    const mockControlWithNullValues = {
      ...mockControl,
      _formValues: {
        modelName: null,
        modelDescription: null,
      },
      _defaultValues: {
        modelName: null,
        modelDescription: null,
      },
    } as unknown as Control<ImportModelFormValues>;
    render(<ModelInfo control={mockControlWithNullValues} />);
    expect(screen.getByTestId('model-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('model-description-input')).toBeInTheDocument();
  });

  it('should enable inputs when isSubmitting is false', () => {
    render(<ModelInfo control={mockControl} isSubmitting={false} />);
    expect(screen.getByTestId('model-name-input')).not.toHaveAttribute('disabled');
    expect(screen.getByTestId('model-description-input')).not.toHaveAttribute('disabled');
  });
});
