// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { signIn } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import { AuthState } from '#constants/auth';
import { PageId } from '#constants/pages';
import { getPath } from '#utils/pageUtils';

import SignInForm from '../SignInForm';

// Mock dependencies
vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: {} }),
  generatePath: (path: string) => path,
}));

const mockDispatch = vi.fn();
vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => mockDispatch,
}));

const mockRefetch = vi.fn();
vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: () => ({
    refetch: mockRefetch,
  }),
}));

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all required fields', () => {
    render(<SignInForm />);

    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Show password/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forgot password/ })).toBeInTheDocument();
  });

  describe('password visibility toggle', () => {
    it('toggles password field type when show password is clicked', () => {
      render(<SignInForm />);
      const passwordInput = screen.getByLabelText(/Password/);
      const showPasswordCheckbox = screen.getByRole('checkbox', { name: /Show password/ });
      // Initially password field should be of type "password"
      expect(passwordInput).toHaveAttribute('type', 'password');
      // Click show password checkbox
      fireEvent.click(showPasswordCheckbox);
      // Password field should now be of type "text"
      expect(passwordInput).toHaveAttribute('type', 'text');
      // Click checkbox again
      fireEvent.click(showPasswordCheckbox);
      // Password field should be back to type "password"
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('form submission', () => {
    it('submits form with valid data and navigates to home', async () => {
      const mockSignIn = signIn as Mock;
      mockSignIn.mockResolvedValueOnce({
        nextStep: { signInStep: 'DONE' },
      });

      render(<SignInForm />);

      fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123!' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          username: 'test@example.com',
          password: 'Password123!',
        });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.HOME));
      });

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('redirects to new password page when password change is required', async () => {
      const mockSignIn = signIn as Mock;
      mockSignIn.mockResolvedValueOnce({
        nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' },
      });

      render(<SignInForm />);

      fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123!' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.SIGN_IN), {
          state: { authState: AuthState.NEW_PASSWORD_REQUIRED },
        });
      });
    });

    it('displays error notification on sign in failure', async () => {
      const mockSignIn = signIn as Mock;
      mockSignIn.mockRejectedValueOnce(new Error('Sign in failed'));

      render(<SignInForm />);

      fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123!' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });
    });
  });

  describe('form validation', () => {
    it('shows error when email is invalid', async () => {
      render(<SignInForm />);
      fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'invalid-email' } });
      fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123!' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
      expect(await screen.findByText(/Must be a valid email address/)).toBeInTheDocument();
    });

    it('shows error when required fields are empty', async () => {
      render(<SignInForm />);
      fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
      const requiredErrors = await screen.findAllByText(/required/i);
      expect(requiredErrors).toHaveLength(2); // Both email and password are required
    });
  });

  describe('navigation', () => {
    it('navigates to forgot password page', () => {
      render(<SignInForm />);

      fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

      expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.FORGOT_PASSWORD_REQUEST));
    });
  });
});
