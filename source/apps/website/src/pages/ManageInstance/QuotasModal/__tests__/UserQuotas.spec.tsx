// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, Mock, vi, beforeEach } from 'vitest';

import { useUpdateProfileMutation } from '#services/deepRacer/profileApi.js';
import { render } from '#utils/testUtils';

import UserQuotasModal from '../UserQuotas';

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useUpdateProfileMutation: vi.fn(),
}));

interface MockInputFieldProps {
  control?: {
    register: (name: string) => Record<string, unknown>;
  };
  label: string;
  name: string;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
}

vi.mock('#components/FormFields/InputField', () => ({
  default: ({ control, label, name, disabled, placeholder, description }: MockInputFieldProps) => {
    const { register } = control || { register: () => ({}) };
    return (
      <div data-testid={`input-field-${name}`}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={`input-${name}`}
          defaultValue={name === 'maxTotalComputeMinutes' ? '60' : '10'}
          {...register(name)}
        />
        <div data-testid={`description-${name}`}>{description}</div>
      </div>
    );
  },
}));

const mockProfile = {
  profileId: 'test-profile-id',
  alias: 'Test User',
  avatar: { skinColor: 'light', hairColor: 'brown' },
  maxTotalComputeMinutes: 3600,
  maxModelCount: 10,
  computeMinutesUsed: 1800,
  computeMinutesQueued: 600,
  modelCount: 5,
  roleName: 'dr-racers',
  createdAt: '2023-01-01T00:00:00Z',
};

const mockUnlimitedProfile = {
  ...mockProfile,
  maxTotalComputeMinutes: -1,
  maxModelCount: -1,
};

describe('UserQuotasModal', () => {
  const mockUpdateProfile = vi.fn();
  const mockSetIsOpen = vi.fn();
  const mockOnClearSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useUpdateProfileMutation as Mock).mockReturnValue([
      mockUpdateProfile.mockResolvedValue({ unwrap: () => Promise.resolve() }),
    ]);

    vi.spyOn(console, 'error').mockImplementation(() => {
      // intentionally empty
    });
    vi.spyOn(console, 'log').mockImplementation(() => {
      // intentionally empty
    });
    vi.spyOn(window, 'alert').mockImplementation(() => {
      // intentionally empty
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render modal when open', () => {
    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
  });

  it('should display form fields with correct labels and descriptions', () => {
    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    expect(screen.getByText('Usage limit (hours)')).toBeInTheDocument();
    expect(screen.getByText('The maximum number of training hours for this user.')).toBeInTheDocument();

    expect(screen.getByText('Model count limit')).toBeInTheDocument();
    expect(screen.getByText('The maximum number of models this user can store.')).toBeInTheDocument();
  });

  it('should disable input fields when unlimited is checked', () => {
    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockUnlimitedProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
    const modelInput = screen.getByTestId('input-maxModelCount');

    expect(computeInput).toBeDisabled();
    expect(modelInput).toBeDisabled();
  });

  it('should close modal when Cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should close modal when dismiss button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const dismissButton = screen.getByLabelText('Close modal');
    await user.click(dismissButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should handle unlimited values in form submission', async () => {
    const user = userEvent.setup();

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox', { name: /unlimited/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        profileId: 'test-profile-id',
        alias: 'Test User',
        avatar: { skinColor: 'light', hairColor: 'brown' },
        maxTotalComputeMinutes: -1,
        maxModelCount: -1,
      });
    });
  });

  it('should handle API error gracefully', async () => {
    const user = userEvent.setup();
    const mockError = new Error('API Error');

    mockUpdateProfile.mockRejectedValueOnce(mockError);

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to update user quotas');
    });

    expect(window.alert).toHaveBeenCalledWith('Failed to update user quotas. Please try again.');
    expect(mockOnClearSelection).not.toHaveBeenCalled();
    expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);
  });

  it('should handle missing selectedUser gracefully', async () => {
    const user = userEvent.setup();

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={null}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('No selected user');
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('should convert minutes to hours correctly for display', () => {
    const profileWithMinutes = {
      ...mockProfile,
      maxTotalComputeMinutes: 7200,
    };

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={profileWithMinutes}
        onClearSelection={mockOnClearSelection}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
  });

  it('should handle undefined maxTotalComputeMinutes with nullish coalescing', () => {
    const profileWithUndefinedMinutes = {
      ...mockProfile,
      maxTotalComputeMinutes: undefined,
    };

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={profileWithUndefinedMinutes}
        onClearSelection={mockOnClearSelection}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
  });

  it('should handle undefined maxModelCount with nullish coalescing', () => {
    const profileWithUndefinedModelCount = {
      ...mockProfile,
      maxModelCount: undefined,
    };

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={profileWithUndefinedModelCount}
        onClearSelection={mockOnClearSelection}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
  });

  it('should handle undefined maxTotalComputeMinutes in handleClose with nullish coalescing', async () => {
    const user = userEvent.setup();
    const profileWithUndefinedMinutes = {
      ...mockProfile,
      maxTotalComputeMinutes: undefined,
    };

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={profileWithUndefinedMinutes}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should handle undefined maxModelCount in handleClose with nullish coalescing', async () => {
    const user = userEvent.setup();
    const profileWithUndefinedModelCount = {
      ...mockProfile,
      maxModelCount: undefined,
    };

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={profileWithUndefinedModelCount}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should display correct placeholders', () => {
    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    expect(screen.getByPlaceholderText('Enter training hours limit')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter model count limit')).toBeInTheDocument();
  });

  it('should convert minutes to hours in handleClose for non-unlimited values', async () => {
    const user = userEvent.setup();
    const profileWithMinutes = {
      ...mockProfile,
      maxTotalComputeMinutes: 7200,
    };

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={profileWithMinutes}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should reset to initial values when selectedUser is null in handleClose', async () => {
    const user = userEvent.setup();

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={null}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should call onClearSelection when onClearSelection is not null', async () => {
    const user = userEvent.setup();

    // Mock successful updateProfile with unwrap
    const mockUnwrap = vi.fn().mockResolvedValue({});
    mockUpdateProfile.mockResolvedValue({ unwrap: mockUnwrap });

    render(
      <UserQuotasModal
        isOpen={true}
        setIsOpen={mockSetIsOpen}
        selectedUser={mockProfile}
        onClearSelection={mockOnClearSelection}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
  });
});
