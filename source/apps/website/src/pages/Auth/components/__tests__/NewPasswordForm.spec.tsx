// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { confirmSignIn } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import NewPasswordForm from '../NewPasswordForm';

// Mock dependencies
vi.mock('aws-amplify/auth', () => ({
  confirmSignIn: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

const mockUpdateProfile = vi.fn();

vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: () => ({
    refetch: vi.fn(),
  }),
  useUpdateProfileMutation: () => [mockUpdateProfile],
}));

describe('NewPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({});
  });

  it('renders the form with all required fields', () => {
    render(<NewPasswordForm />);

    expect(screen.getByLabelText(/racer alias/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /show password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });
});

describe('password visibility toggle', () => {
  it('toggles password field types when show password is clicked', () => {
    render(<NewPasswordForm />);

    // Get password input fields and checkbox
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const showPasswordCheckbox = screen.getByRole('checkbox', { name: /show password/i });

    // Initially password fields should be of type "password"
    expect(newPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    // Click show password checkbox
    fireEvent.click(showPasswordCheckbox);

    // Password fields should now be of type "text"
    expect(newPasswordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');

    // Click checkbox again
    fireEvent.click(showPasswordCheckbox);

    // Password fields should be back to type "password"
    expect(newPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });
});

describe('form submission', () => {
  it('submits form with valid data and updates profile', async () => {
    const mockConfirmSignIn = confirmSignIn as Mock;
    mockConfirmSignIn.mockResolvedValueOnce({});

    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'TestRacer123' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(mockConfirmSignIn).toHaveBeenCalledWith({
        challengeResponse: 'Password123!',
      });
    });

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        alias: 'TestRacer123',
      });
    });
  });
});

describe('form validation', () => {
  it('shows error when password is too short', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Short1!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Short1!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows error when password is missing lowercase', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'PASSWORD123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'PASSWORD123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Must contain a lowercase letter/i)).toBeInTheDocument();
  });

  it('shows error when password is missing number', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password!!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password!!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Must contain a number/i)).toBeInTheDocument();
  });

  it('shows error when password is missing special character', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Must contain a special character/i)).toBeInTheDocument();
  });

  it('shows error when racer alias is too short', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'ab' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Must be at least 3 characters/i)).toBeInTheDocument();
  });

  it('shows error when racer alias is too long', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'ThisAliasIsTooLongForValidation' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Must be 20 characters or less/i)).toBeInTheDocument();
  });

  it('shows error when racer alias contains invalid characters', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'racer@123' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/Only letters, numbers, hyphens, and underscores allowed/i)).toBeInTheDocument();
  });
});
