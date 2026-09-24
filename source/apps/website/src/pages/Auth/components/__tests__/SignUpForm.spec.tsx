// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { signUp } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import { PageId } from '#constants/pages';
import { getPath } from '#utils/pageUtils';

import SignUpForm from '../SignUpForm';

vi.mock('aws-amplify/auth', () => ({
  signUp: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    generatePath: (path: string) => path,
  };
});

const mockDispatch = vi.fn();
vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('#utils/resourceUtils', () => ({
  generateResourceId: () => 'generated-user-id',
}));

const fillField = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
};

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, racer alias, country, and password fields', () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Racer alias/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Country code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign up/ })).toBeInTheDocument();
  });

  it('signs up via the email-verification flow with alias in clientMetadata and navigates to verify email', async () => {
    (signUp as Mock).mockResolvedValue({});
    render(<SignUpForm />);

    fillField(/Email address/, 'racer@example.com');
    fillField(/Racer alias/, 'speedy_racer');
    fillField(/Country code/, 'us');
    fillField(/Password/, 'Passw0rd!');
    fireEvent.click(screen.getByRole('button', { name: /Sign up/ }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'generated-user-id',
          password: 'Passw0rd!',
          options: expect.objectContaining({
            userAttributes: expect.objectContaining({
              email: 'racer@example.com',
              'custom:countryCode': 'US',
            }),
            clientMetadata: { racerAlias: 'speedy_racer' },
          }),
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.VERIFY_EMAIL), {
      state: { username: 'generated-user-id' },
    });
  });

  it('omits countryCode when the field is left blank', async () => {
    (signUp as Mock).mockResolvedValue({});
    render(<SignUpForm />);

    fillField(/Email address/, 'racer@example.com');
    fillField(/Racer alias/, 'speedy_racer');
    fillField(/Password/, 'Passw0rd!');
    fireEvent.click(screen.getByRole('button', { name: /Sign up/ }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const call = (signUp as Mock).mock.calls[0][0];
    expect(call.options.userAttributes).not.toHaveProperty('custom:countryCode');
  });

  it('shows a generic failure notification for a non-NotAuthorizedException error', async () => {
    (signUp as Mock).mockRejectedValue(new Error('sign up failed'));
    render(<SignUpForm />);

    fillField(/Email address/, 'racer@example.com');
    fillField(/Racer alias/, 'speedy_racer');
    fillField(/Password/, 'Passw0rd!');
    fireEvent.click(screen.getByRole('button', { name: /Sign up/ }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe('Sign up attempt failed. Please try again.');
  });

  it('shows the self-registration-not-supported notification when signUp rejects with NotAuthorizedException', async () => {
    const notAuthorizedError = new Error('User pool does not allow self sign up');
    notAuthorizedError.name = 'NotAuthorizedException';
    (signUp as Mock).mockRejectedValue(notAuthorizedError);
    render(<SignUpForm />);

    fillField(/Email address/, 'racer@example.com');
    fillField(/Racer alias/, 'speedy_racer');
    fillField(/Password/, 'Passw0rd!');
    fireEvent.click(screen.getByRole('button', { name: /Sign up/ }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe(
      "Self-service sign up isn't available for this deployment. Please contact a Registration manager to create an account for you.",
    );
  });

  it('renders the "Already have an account" sign-in link as a non-submitting button', () => {
    render(<SignUpForm />);
    const signInButton = screen.getByRole('button', { name: /^Sign in$/ });
    expect(signInButton).toHaveAttribute('type', 'button');
  });

  it('navigates to sign in via the "Already have an account" link', () => {
    render(<SignUpForm />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.SIGN_IN));
  });
});
