// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, Mock, vi, beforeEach } from 'vitest';

import { useGetGlobalSettingQuery, useUpdateGlobalSettingMutation } from '#services/deepRacer/settingsApi.js';
import { render } from '#utils/testUtils';

import NewUserQuotasModal from '../NewUserQuotas';

vi.mock('#services/deepRacer/settingsApi.js', () => ({
  useGetGlobalSettingQuery: vi.fn(),
  useUpdateGlobalSettingMutation: vi.fn(),
}));

vi.mock('../BaseQuotasModal', () => ({
  default: ({
    isOpen,
    setIsOpen,
    config,
  }: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    config: {
      modalHeader: string;
      computeField: {
        name: string;
        label: string;
        description: string;
        fieldKey: string;
      };
      modelCountField: {
        name: string;
        label: string;
        description: string;
        fieldKey: string;
      };
      keyToUpdate: string;
    };
  }) => {
    if (!isOpen) return null;

    return (
      <div data-testid="base-quotas-modal">
        <div data-testid="modal-header">{config.modalHeader}</div>
        <div data-testid="compute-field-name">{config.computeField.name}</div>
        <div data-testid="compute-field-label">{config.computeField.label}</div>
        <div data-testid="compute-field-description">{config.computeField.description}</div>
        <div data-testid="compute-field-key">{config.computeField.fieldKey}</div>
        <div data-testid="model-field-name">{config.modelCountField.name}</div>
        <div data-testid="model-field-label">{config.modelCountField.label}</div>
        <div data-testid="model-field-description">{config.modelCountField.description}</div>
        <div data-testid="model-field-key">{config.modelCountField.fieldKey}</div>
        <div data-testid="key-to-update">{config.keyToUpdate}</div>
        <button onClick={() => setIsOpen(false)}>Close</button>
      </div>
    );
  },
}));

describe('NewUserQuotasModal', () => {
  const mockUpdateGlobalSetting = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useGetGlobalSettingQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    (useUpdateGlobalSettingMutation as Mock).mockReturnValue([
      mockUpdateGlobalSetting.mockResolvedValue({ unwrap: () => Promise.resolve() }),
    ]);
  });

  it('should render BaseQuotasModal when open', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('base-quotas-modal')).toBeInTheDocument();
  });

  it('should not render BaseQuotasModal when closed', () => {
    render(<NewUserQuotasModal isOpen={false} setIsOpen={vi.fn()} />);

    expect(screen.queryByTestId('base-quotas-modal')).not.toBeInTheDocument();
  });

  it('should pass correct configuration to BaseQuotasModal', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('modal-header')).toHaveTextContent('New user quotas');

    expect(screen.getByTestId('compute-field-name')).toHaveTextContent('newUserComputeMinutesLimit');
    expect(screen.getByTestId('compute-field-label')).toHaveTextContent('New user compute usage limit (hours)');
    expect(screen.getByTestId('compute-field-description')).toHaveTextContent(
      'The maximum number of training hours for new users.',
    );
    expect(screen.getByTestId('compute-field-key')).toHaveTextContent('usageQuotas.newUser.newUserComputeMinutesLimit');

    expect(screen.getByTestId('model-field-name')).toHaveTextContent('newUserModelCountLimit');
    expect(screen.getByTestId('model-field-label')).toHaveTextContent('New user model count limit');
    expect(screen.getByTestId('model-field-description')).toHaveTextContent(
      'The maximum number of models for new users.',
    );
    expect(screen.getByTestId('model-field-key')).toHaveTextContent('usageQuotas.newUser.newUserModelCountLimit');

    expect(screen.getByTestId('key-to-update')).toHaveTextContent('usageQuotas.newUser');
  });

  it('should pass isOpen prop to BaseQuotasModal', () => {
    const { rerender } = render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('base-quotas-modal')).toBeInTheDocument();

    rerender(<NewUserQuotasModal isOpen={false} setIsOpen={vi.fn()} />);

    expect(screen.queryByTestId('base-quotas-modal')).not.toBeInTheDocument();
  });

  it('should pass setIsOpen prop to BaseQuotasModal', async () => {
    const user = userEvent.setup();
    const mockSetIsOpen = vi.fn();

    render(<NewUserQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should have correct field names for new user quotas', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-name')).toHaveTextContent('newUserComputeMinutesLimit');
    expect(screen.getByTestId('model-field-name')).toHaveTextContent('newUserModelCountLimit');
  });

  it('should have correct field keys for API queries', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-key')).toHaveTextContent('usageQuotas.newUser.newUserComputeMinutesLimit');
    expect(screen.getByTestId('model-field-key')).toHaveTextContent('usageQuotas.newUser.newUserModelCountLimit');
  });

  it('should use correct key for updating settings', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('key-to-update')).toHaveTextContent('usageQuotas.newUser');
  });

  it('should have descriptive labels for new user context', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-label')).toHaveTextContent('New user compute usage limit (hours)');
    expect(screen.getByTestId('model-field-label')).toHaveTextContent('New user model count limit');
  });

  it('should have appropriate descriptions for new user quotas', () => {
    render(<NewUserQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-description')).toHaveTextContent(
      'The maximum number of training hours for new users.',
    );
    expect(screen.getByTestId('model-field-description')).toHaveTextContent(
      'The maximum number of models for new users.',
    );
  });

  it('should be a simple wrapper component', () => {
    const mockSetIsOpen = vi.fn();

    render(<NewUserQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} />);

    expect(screen.getByTestId('base-quotas-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-header')).toHaveTextContent('New user quotas');
  });
});
