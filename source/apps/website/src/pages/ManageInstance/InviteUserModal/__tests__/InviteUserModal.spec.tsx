// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useController, Control } from 'react-hook-form';
import { Provider } from 'react-redux';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useCreateProfileMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

import InviteUserModal from '../InviteUserModal';

vi.mock('#services/deepRacer/profileApi');
vi.mock('#hooks/useAppDispatch');
vi.mock('#store/notifications/notificationsSlice');

vi.mock('#components/FormFields/InputField', () => {
  function MockInputField({
    control,
    name,
    label,
    description,
    placeholder,
    type,
    ...props
  }: {
    control: Control<import('react-hook-form').FieldValues>;
    name: string;
    label: string;
    description?: string;
    placeholder?: string;
    type?: string;
    [key: string]: unknown;
  }) {
    const {
      field: { onChange, onBlur, value, ref },
      fieldState: { error },
    } = useController({ control, name });

    return (
      <div data-testid={`input-field-${name}`}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          aria-describedby={`${name}-description`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          ref={ref}
          {...props}
        />
        <div id={`${name}-description`}>{description}</div>
        {error && <div data-testid={`${name}-error`}>{error.message}</div>}
      </div>
    );
  }
  return { default: MockInputField };
});

describe('InviteUserModal', () => {
  const mockSetIsOpen = vi.fn();
  const mockDispatch = vi.fn();
  const mockCreateProfile = vi.fn();
  const mockUseCreateProfileMutation = useCreateProfileMutation as Mock;
  const mockUseAppDispatch = useAppDispatch as unknown as Mock;

  const createTestStore = () =>
    configureStore({
      reducer: {
        notifications: (state = {}) => state,
      },
    });

  const renderWithProvider = (component: React.ReactElement) => {
    const store = createTestStore();
    return render(<Provider store={store}>{component}</Provider>);
  };

  const defaultProps = {
    isOpen: true,
    setIsOpen: mockSetIsOpen,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseCreateProfileMutation.mockReturnValue([mockCreateProfile, { isLoading: false }]);
  });

  describe('Rendering', () => {
    it('should render the modal when isOpen is true', () => {
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Invite user')).toBeInTheDocument();
    });

    it('should render form elements correctly', () => {
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      expect(screen.getByTestId('input-field-email')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByText('Enter the email address of the user you want to invite.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter email address')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
    });

    it('should disable Invite button when email is empty', () => {
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const inviteButton = screen.getByRole('button', { name: 'Invite' });
      expect(inviteButton).toBeDisabled();
    });
  });

  describe('Form Interactions', () => {
    it('should call setIsOpen(false) when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid email and show success notification', async () => {
      const user = userEvent.setup();
      const testEmail = 'test@example.com';

      const mockUnwrap = vi.fn().mockResolvedValue('Success message');
      mockCreateProfile.mockReturnValue({
        unwrap: mockUnwrap,
      });

      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email address');
      const inviteButton = screen.getByRole('button', { name: 'Invite' });

      await user.type(emailInput, testEmail);

      await waitFor(() => {
        expect(inviteButton).not.toBeDisabled();
      });

      await user.click(inviteButton);

      await waitFor(() => {
        expect(mockCreateProfile).toHaveBeenCalledWith({
          emailAddress: testEmail,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({
            content: `User invitation sent to ${testEmail}`,
          }),
        );
      });

      await waitFor(() => {
        expect(mockSetIsOpen).toHaveBeenCalledWith(false);
      });
    });

    it('should handle API error and show error notification', async () => {
      const user = userEvent.setup();
      const testEmail = 'test@example.com';
      const errorMessage = 'API Error';

      mockCreateProfile.mockRejectedValue({
        unwrap: () => Promise.reject(new Error(errorMessage)),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Empty implementation
      });

      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email address');
      const inviteButton = screen.getByRole('button', { name: 'Invite' });

      await user.type(emailInput, testEmail);
      await user.click(inviteButton);

      await waitFor(() => {
        expect(mockCreateProfile).toHaveBeenCalledWith({
          emailAddress: testEmail,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displayErrorNotification({
            content: 'Failed to invite user. Please try again.',
          }),
        );
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to invite user');
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);

      consoleSpy.mockRestore();
    });

    it('should not submit form with invalid email', async () => {
      const user = userEvent.setup();
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email address');
      const inviteButton = screen.getByRole('button', { name: 'Invite' });

      await user.type(emailInput, 'invalid-email');
      await user.click(inviteButton);

      expect(mockCreateProfile).not.toHaveBeenCalled();
    });

    it('should not submit form when email is empty', async () => {
      const user = userEvent.setup();
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const inviteButton = screen.getByRole('button', { name: 'Invite' });

      expect(inviteButton).toBeDisabled();

      await user.click(inviteButton);
      expect(mockCreateProfile).not.toHaveBeenCalled();
    });
  });

  describe('Form Reset', () => {
    it('should reset form when modal is closed via Cancel button', async () => {
      const user = userEvent.setup();
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email address');
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });

      await user.type(emailInput, 'test@example.com');
      expect(emailInput).toHaveValue('test@example.com');

      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Email Validation', () => {
    it('should require email field', async () => {
      const user = userEvent.setup();
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email address');
      const inviteButton = screen.getByRole('button', { name: 'Invite' });

      expect(inviteButton).toBeDisabled();

      await user.type(emailInput, 'test');
      await user.clear(emailInput);

      expect(inviteButton).toBeDisabled();
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only email input', async () => {
      const user = userEvent.setup();
      renderWithProvider(<InviteUserModal {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email address');
      const inviteButton = screen.getByRole('button', { name: 'Invite' });

      await user.type(emailInput, '   ');

      expect(inviteButton).toBeDisabled();
    });
  });
});
