// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useController } from 'react-hook-form';
import { describe, expect, it, Mock, vi, beforeEach } from 'vitest';

import { useGetGlobalSettingQuery, useUpdateGlobalSettingMutation } from '#services/deepRacer/settingsApi.js';
import { render } from '#utils/testUtils';

import BaseQuotasModal, { QuotasConfig } from '../BaseQuotasModal';

vi.mock('#services/deepRacer/settingsApi.js', () => ({
  useGetGlobalSettingQuery: vi.fn(),
  useUpdateGlobalSettingMutation: vi.fn(),
}));

vi.mock('#components/FormFields/InputField', () => {
  interface InputFieldProps {
    label: string;
    name: string;
    disabled?: boolean;
    placeholder?: string;
    control?: import('react-hook-form').Control<Record<string, unknown>>;
    type?: string;
  }

  const MockInputField = ({ label, name, disabled, placeholder, control, type }: InputFieldProps) => {
    const { field } = useController({ control, name });

    return (
      <div data-testid={`input-field-${name}`}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          type={type}
          disabled={disabled}
          placeholder={placeholder}
          data-testid={`input-${name}`}
          value={
            typeof field.value === 'string' || typeof field.value === 'number' || Array.isArray(field.value)
              ? field.value
              : ''
          }
          onChange={(e) => {
            const value = type === 'number' ? Number(e.target.value) : e.target.value;
            field.onChange(value);
          }}
        />
      </div>
    );
  };

  return {
    default: MockInputField,
  };
});

vi.mock('@cloudscape-design/components/modal', () => ({
  default: ({
    visible,
    children,
    header,
    onDismiss,
  }: React.PropsWithChildren<{
    visible: boolean;
    header?: React.ReactNode;
    onDismiss?: () => void;
  }>) => {
    if (!visible) return null;
    return (
      <div data-testid="modal">
        <div data-testid="modal-header">{header}</div>
        <button aria-label="Close modal" onClick={onDismiss}>
          ×
        </button>
        {children}
      </div>
    );
  },
}));

vi.mock('@cloudscape-design/components/button', () => ({
  default: ({
    children,
    onClick,
    variant,
    formAction,
  }: React.PropsWithChildren<{
    onClick?: () => void;
    variant?: string;
    formAction?: string;
  }>) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-form-action={formAction}
      type={formAction === 'submit' ? 'submit' : 'button'}
    >
      {children}
    </button>
  ),
}));

vi.mock('@cloudscape-design/components/checkbox', () => ({
  default: ({
    checked,
    onChange,
    children,
  }: React.PropsWithChildren<{
    checked: boolean;
    onChange: (event: { detail: { checked: boolean } }) => void;
  }>) => (
    <label>
      <input type="checkbox" checked={checked} onChange={(e) => onChange({ detail: { checked: e.target.checked } })} />
      {children}
    </label>
  ),
}));

vi.mock('@cloudscape-design/components/column-layout', () => ({
  default: ({ children }: React.PropsWithChildren<object>) => <div>{children}</div>,
}));

vi.mock('@cloudscape-design/components/form', () => ({
  default: ({ children, actions }: React.PropsWithChildren<{ actions?: React.ReactNode }>) => (
    <div>
      {children}
      <div data-testid="form-actions">{actions}</div>
    </div>
  ),
}));

vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: React.PropsWithChildren<object>) => <div>{children}</div>,
}));

describe('BaseQuotasModal', () => {
  const mockConfig: QuotasConfig = {
    modalHeader: 'Test Quotas Modal',
    computeField: {
      name: 'computeLimit',
      label: 'Compute Limit',
      description: 'Set the compute limit in hours',
      fieldKey: 'compute.limit',
    },
    modelCountField: {
      name: 'modelLimit',
      label: 'Model Limit',
      description: 'Set the model count limit',
      fieldKey: 'model.limit',
    },
    keyToUpdate: 'test.quotas',
  };

  const mockUpdateGlobalSetting = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => {
      if (key === 'compute.limit') {
        return { data: '120', isLoading: false, error: null };
      }
      if (key === 'model.limit') {
        return { data: '10', isLoading: false, error: null };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    (useUpdateGlobalSettingMutation as Mock).mockReturnValue([
      mockUpdateGlobalSetting.mockResolvedValue({ unwrap: () => Promise.resolve() }),
    ]);
  });

  it('should render modal with correct header when open', () => {
    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.getByText('Test Quotas Modal')).toBeInTheDocument();
  });

  it('should not render modal when closed', () => {
    render(<BaseQuotasModal isOpen={false} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.queryByText('Test Quotas Modal')).not.toBeInTheDocument();
  });

  it('should render form fields with correct labels and descriptions', () => {
    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.getByText('Compute Limit')).toBeInTheDocument();
    expect(screen.getByText('Model Limit')).toBeInTheDocument();
    expect(screen.getByTestId('input-field-computeLimit')).toBeInTheDocument();
    expect(screen.getByTestId('input-field-modelLimit')).toBeInTheDocument();
  });

  it('should render Cancel and Confirm buttons', () => {
    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('should render unlimited checkboxes for both fields', () => {
    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    const unlimitedCheckboxes = screen.getAllByText('Unlimited');
    expect(unlimitedCheckboxes).toHaveLength(2);
  });

  it('should populate form fields with data from API', async () => {
    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toHaveValue(2);
    });

    await waitFor(() => {
      const modelInput = screen.getByTestId('input-modelLimit');
      expect(modelInput).toHaveValue(10);
    });
  });

  it('should handle unlimited values (-1) correctly', async () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => {
      if (key === 'compute.limit') {
        return { data: '-1', isLoading: false, error: null };
      }
      if (key === 'model.limit') {
        return { data: '-1', isLoading: false, error: null };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const unlimitedCheckboxes = screen.getAllByRole('checkbox');
      expect(unlimitedCheckboxes[0]).toBeChecked();
    });

    await waitFor(() => {
      const unlimitedCheckboxes = screen.getAllByRole('checkbox');
      expect(unlimitedCheckboxes[1]).toBeChecked();
    });
  });

  it('should disable input fields when unlimited checkbox is checked', async () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => {
      if (key === 'compute.limit') {
        return { data: '-1', isLoading: false, error: null };
      }
      if (key === 'model.limit') {
        return { data: '10', isLoading: false, error: null };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toBeDisabled();
    });

    await waitFor(() => {
      const modelInput = screen.getByTestId('input-modelLimit');
      expect(modelInput).not.toBeDisabled();
    });
  });

  it('should call setIsOpen(false) when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mockSetIsOpen = vi.fn();

    render(<BaseQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} config={mockConfig} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should call setIsOpen(false) when modal is dismissed', async () => {
    const user = userEvent.setup();
    const mockSetIsOpen = vi.fn();

    render(<BaseQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} config={mockConfig} />);

    const closeButton = screen.getByLabelText('Close modal');
    await user.click(closeButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should reset form values when modal is closed', async () => {
    const user = userEvent.setup();
    const mockSetIsOpen = vi.fn();

    render(<BaseQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toHaveValue(2);
    });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should toggle unlimited checkbox and update field value', async () => {
    const user = userEvent.setup();

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toHaveValue(2);
    });

    const unlimitedCheckboxes = screen.getAllByRole('checkbox');
    const computeUnlimitedCheckbox = unlimitedCheckboxes[0];

    await user.click(computeUnlimitedCheckbox);

    await waitFor(() => {
      expect(computeUnlimitedCheckbox).toBeChecked();
    });

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toBeDisabled();
    });
  });

  it('should submit form with unlimited values (-1) when checkboxes are checked', async () => {
    const user = userEvent.setup();

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toHaveValue(2);
    });

    const unlimitedCheckboxes = screen.getAllByRole('checkbox');
    await user.click(unlimitedCheckboxes[0]);
    await user.click(unlimitedCheckboxes[1]);

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockUpdateGlobalSetting).toHaveBeenCalledWith({
        key: 'test.quotas',
        value: {
          computeLimit: '-1',
          modelLimit: '-1',
        },
      });
    });
  });

  it('should handle undefined API data gracefully', () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      error: null,
    }));

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.getByText('Test Quotas Modal')).toBeInTheDocument();
  });

  it('should handle loading state from API queries', () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }));

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.getByText('Test Quotas Modal')).toBeInTheDocument();
  });

  it('should handle API error state gracefully', () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      error: { message: 'API Error' },
    }));

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    expect(screen.getByText('Test Quotas Modal')).toBeInTheDocument();
  });

  it('should convert minutes to hours correctly for display', async () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => {
      if (key === 'compute.limit') {
        return { data: '180', isLoading: false, error: null };
      }
      return { data: '5', isLoading: false, error: null };
    });

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toHaveValue(3);
    });
  });

  it('should handle fractional hours correctly', async () => {
    (useGetGlobalSettingQuery as Mock).mockImplementation(({ key }: { key: string }) => {
      if (key === 'compute.limit') {
        return { data: '90', isLoading: false, error: null };
      }
      if (key === 'model.limit') {
        return { data: '5', isLoading: false, error: null };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    await waitFor(() => {
      const computeInput = screen.getByTestId('input-computeLimit');
      expect(computeInput).toHaveValue(2);
    });
  });

  it('should use correct placeholders for input fields', () => {
    render(<BaseQuotasModal isOpen={true} setIsOpen={vi.fn()} config={mockConfig} />);

    const computeInput = screen.getByTestId('input-computeLimit');
    const modelInput = screen.getByTestId('input-modelLimit');

    expect(computeInput).toHaveAttribute('placeholder', 'Enter training hours limit');
    expect(modelInput).toHaveAttribute('placeholder', 'Enter model count limit');
  });
});
