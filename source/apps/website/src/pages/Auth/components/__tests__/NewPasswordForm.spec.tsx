// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { confirmSignIn } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import { AuthState } from '#constants/auth';
import { PageId } from '#constants/pages';
import { getPath } from '#utils/pageUtils';

import NewPasswordForm from '../NewPasswordForm';

// Mock dependencies
vi.mock('aws-amplify/auth', () => ({
  confirmSignIn: vi.fn(),
}));

const mockNavigate = vi.fn();
let mockLocationState: { email?: string; redirectUrl?: string } = {};
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  };
});

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => vi.fn(),
}));

const mockUpdateProfile = vi.fn();
const mockRefetch = vi.fn();

vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: () => ({
    refetch: mockRefetch,
  }),
  useUpdateProfileMutation: () => [mockUpdateProfile],
}));

// File-level (not nested in a single describe) so it applies to every sibling describe block
// below — these tests used to pass with a describe-scoped beforeEach only because the old
// component code never depended on updateProfile/refetch's resolved values; now that it does
// (see the bugfix in NewPasswordForm.tsx), every describe block needs this setup.
beforeEach(() => {
  vi.clearAllMocks();
  mockLocationState = { email: 'admin@example.com' };
  mockUpdateProfile.mockResolvedValue({});
  mockRefetch.mockResolvedValue({ data: { alias: 'TestRacer123' } });
});

describe('NewPasswordForm', () => {
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
  it('submits form with valid data, updates profile, and navigates home when no further challenge is pending', async () => {
    const mockConfirmSignIn = confirmSignIn as Mock;
    mockConfirmSignIn.mockResolvedValueOnce({ nextStep: { signInStep: 'DONE' } });

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

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.HOME));
    });
  });

  // Regression test: setting a new password used to be treated as "fully signed in" even when
  // Cognito chained straight into another challenge (e.g. NEW_PASSWORD_REQUIRED chaining further)
  // — this called updateProfile/navigated home against a session that wasn't actually established
  // yet, which is what made the user look logged out.
  it('does NOT update the profile or navigate home when the password change chains into another challenge', async () => {
    const mockConfirmSignIn = confirmSignIn as Mock;
    mockConfirmSignIn.mockResolvedValueOnce({
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' },
    });

    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'TestRacer123' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.SIGN_IN), {
        state: {
          authState: AuthState.NEW_PASSWORD_REQUIRED,
          email: 'admin@example.com',
          racerAlias: 'TestRacer123',
          redirectUrl: undefined,
        },
      });
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
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
