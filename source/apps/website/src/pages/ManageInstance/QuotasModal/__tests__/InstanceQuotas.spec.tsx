// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, Mock, vi, beforeEach } from 'vitest';

import { useGetGlobalSettingQuery, useUpdateGlobalSettingMutation } from '#services/deepRacer/settingsApi.js';
import { render } from '#utils/testUtils';

import InstanceQuotasModal from '../InstanceQuotas';

vi.mock('#services/deepRacer/settingsApi.js', () => ({
  useGetGlobalSettingQuery: vi.fn(),
  useUpdateGlobalSettingMutation: vi.fn(),
}));

interface MockBaseQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
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
}

vi.mock('../BaseQuotasModal', () => ({
  default: ({ isOpen, setIsOpen, config }: MockBaseQuotasModalProps) => {
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

describe('InstanceQuotasModal', () => {
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
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('base-quotas-modal')).toBeInTheDocument();
  });

  it('should not render BaseQuotasModal when closed', () => {
    render(<InstanceQuotasModal isOpen={false} setIsOpen={vi.fn()} />);

    expect(screen.queryByTestId('base-quotas-modal')).not.toBeInTheDocument();
  });

  it('should pass correct configuration to BaseQuotasModal', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('modal-header')).toHaveTextContent('Instance quotas');

    expect(screen.getByTestId('compute-field-name')).toHaveTextContent('globalComputeMinutesLimit');
    expect(screen.getByTestId('compute-field-label')).toHaveTextContent('Global compute usage limit (hours)');
    expect(screen.getByTestId('compute-field-description')).toHaveTextContent(
      'The maximum number of training hours to be used by the instance.',
    );
    expect(screen.getByTestId('compute-field-key')).toHaveTextContent('usageQuotas.global.globalComputeMinutesLimit');

    expect(screen.getByTestId('model-field-name')).toHaveTextContent('globalModelCountLimit');
    expect(screen.getByTestId('model-field-label')).toHaveTextContent('Global model count limit');
    expect(screen.getByTestId('model-field-description')).toHaveTextContent(
      'The maximum number of models to be stored on the instance.',
    );
    expect(screen.getByTestId('model-field-key')).toHaveTextContent('usageQuotas.global.globalModelCountLimit');

    expect(screen.getByTestId('key-to-update')).toHaveTextContent('usageQuotas.global');
  });

  it('should pass isOpen prop to BaseQuotasModal', () => {
    const { rerender } = render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('base-quotas-modal')).toBeInTheDocument();

    rerender(<InstanceQuotasModal isOpen={false} setIsOpen={vi.fn()} />);

    expect(screen.queryByTestId('base-quotas-modal')).not.toBeInTheDocument();
  });

  it('should pass setIsOpen prop to BaseQuotasModal', async () => {
    const user = userEvent.setup();
    const mockSetIsOpen = vi.fn();

    render(<InstanceQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should have correct field names for instance quotas', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-name')).toHaveTextContent('globalComputeMinutesLimit');
    expect(screen.getByTestId('model-field-name')).toHaveTextContent('globalModelCountLimit');
  });

  it('should have correct field keys for API queries', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-key')).toHaveTextContent('usageQuotas.global.globalComputeMinutesLimit');
    expect(screen.getByTestId('model-field-key')).toHaveTextContent('usageQuotas.global.globalModelCountLimit');
  });

  it('should use correct key for updating settings', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('key-to-update')).toHaveTextContent('usageQuotas.global');
  });

  it('should have descriptive labels for instance context', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-label')).toHaveTextContent('Global compute usage limit (hours)');
    expect(screen.getByTestId('model-field-label')).toHaveTextContent('Global model count limit');
  });

  it('should have appropriate descriptions for instance quotas', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-description')).toHaveTextContent(
      'The maximum number of training hours to be used by the instance.',
    );
    expect(screen.getByTestId('model-field-description')).toHaveTextContent(
      'The maximum number of models to be stored on the instance.',
    );
  });

  it('should use global scope for field keys and update key', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-key')).toHaveTextContent('usageQuotas.global.globalComputeMinutesLimit');
    expect(screen.getByTestId('model-field-key')).toHaveTextContent('usageQuotas.global.globalModelCountLimit');
    expect(screen.getByTestId('key-to-update')).toHaveTextContent('usageQuotas.global');
  });

  it('should differentiate from new user quotas with global prefix', () => {
    render(<InstanceQuotasModal isOpen={true} setIsOpen={vi.fn()} />);

    expect(screen.getByTestId('compute-field-name')).toHaveTextContent('globalComputeMinutesLimit');
    expect(screen.getByTestId('model-field-name')).toHaveTextContent('globalModelCountLimit');
  });

  it('should be a simple wrapper component', () => {
    const mockSetIsOpen = vi.fn();

    render(<InstanceQuotasModal isOpen={true} setIsOpen={mockSetIsOpen} />);

    expect(screen.getByTestId('base-quotas-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-header')).toHaveTextContent('Instance quotas');
  });
});
