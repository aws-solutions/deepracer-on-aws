// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { confirmSignIn } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import { PageId } from '#constants/pages';
import { getPath } from '#utils/pageUtils';

import CompleteProfileForm from '../CompleteProfileForm';

// CompleteProfileForm must never answer a Cognito challenge — the user already has a fully
// established session by the time they reach this screen (e.g. after an SSO redirect-return),
// so confirmSignIn is mocked here purely to prove the component never touches it.
vi.mock('aws-amplify/auth', () => ({
  confirmSignIn: vi.fn(),
}));

const mockNavigate = vi.fn();
let mockLocationState: { redirectUrl?: string } = {};
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

const mockRefetch = vi.fn();
const mockUpdateProfile = vi.fn();
vi.mock('#services/deepRacer/profileApi', () => ({
  useGetProfileQuery: () => ({
    refetch: mockRefetch,
  }),
  useUpdateProfileMutation: () => [mockUpdateProfile],
}));

describe('CompleteProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState = {};
    mockUpdateProfile.mockResolvedValue({});
    mockRefetch.mockResolvedValue({ data: { alias: 'NewRacer' } });
  });

  it('renders the form with the racer alias field', () => {
    render(<CompleteProfileForm />);

    expect(screen.getByLabelText(/racer alias/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('does not call confirmSignIn — the user is already fully authenticated here', async () => {
    render(<CompleteProfileForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'NewRacer' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ alias: 'NewRacer' });
    });

    expect(confirmSignIn as Mock).not.toHaveBeenCalled();
  });

  it('submits the alias, waits for the refetch, and navigates home by default', async () => {
    render(<CompleteProfileForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'NewRacer' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ alias: 'NewRacer' });
    });

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getPath(PageId.HOME));
    });

    // Regression test: navigate must not fire before refetch resolves — otherwise RequiresAuth
    // (reading the same cache) can see a still-stale blank-alias profile at the new route and
    // bounce straight back to this screen.
    const refetchOrder = mockRefetch.mock.invocationCallOrder[0];
    const navigateOrder = mockNavigate.mock.invocationCallOrder[0];
    expect(navigateOrder).toBeGreaterThan(refetchOrder);
  });

  it('navigates to the redirectUrl from router state when provided', async () => {
    mockLocationState = { redirectUrl: '/some/protected/route' };

    render(<CompleteProfileForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'NewRacer' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/some/protected/route');
    });
  });

  it('shows an error when the alias is too short', async () => {
    render(<CompleteProfileForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/Must be at least 3 characters/i)).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('shows an error when the alias contains invalid characters', async () => {
    render(<CompleteProfileForm />);
    fireEvent.change(screen.getByLabelText(/racer alias/i), { target: { value: 'racer@123' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/Only letters, numbers, hyphens, and underscores allowed/i)).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});
