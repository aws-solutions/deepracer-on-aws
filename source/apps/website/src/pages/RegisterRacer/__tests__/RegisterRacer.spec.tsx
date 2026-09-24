// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { render } from '#utils/testUtils';

import RegisterRacer from '../index';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockRegisterUser = vi.fn();
const mockDispatch = vi.fn();

vi.mock('#services/deepRacer/profileApi', () => ({
  useRegisterUserMutation: vi.fn(() => [mockRegisterUser, { isLoading: false }]),
}));

vi.mock('#hooks/useAppDispatch', () => ({
  useAppDispatch: vi.fn(() => mockDispatch),
}));

vi.mock('#store/notifications/notificationsSlice', () => ({
  displaySuccessNotification: vi.fn((p) => p),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPage = () =>
  render(<RegisterRacer />, {
    componentRoute: '/race-management/register',
    initialRouteEntries: ['/race-management/register'],
  });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<RegisterRacer />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterUser.mockResolvedValue({});
  });

  it('renders page header and email field', () => {
    renderPage();
    expect(screen.getByText('Register walk-up racer')).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register racer' })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Register racer' }));
    await waitFor(() => {
      expect(screen.getByText('Email address is required')).toBeInTheDocument();
    });
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid email format', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('racer@example.com'), {
      target: { value: 'not-an-email' },
    });
    // Trigger onBlur validation (Cloudscape Input calls validate on blur)
    fireEvent.blur(screen.getByPlaceholderText('racer@example.com'));
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it('clears validation error when user starts typing', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Register racer' }));
    await screen.findByText('Email address is required');

    fireEvent.change(screen.getByPlaceholderText('racer@example.com'), {
      target: { value: 'r' },
    });
    expect(screen.queryByText('Email address is required')).not.toBeInTheDocument();
  });

  it('calls registerUser and dispatches success notification on valid submit', async () => {
    mockRegisterUser.mockResolvedValue({ unwrap: () => Promise.resolve({}) });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('racer@example.com'), {
      target: { value: 'racer@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register racer' }));
    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({ emailAddress: 'racer@example.com' });
    });
  });

  it('uppercases and passes an optional country code on valid submit', async () => {
    mockRegisterUser.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('racer@example.com'), {
      target: { value: 'racer@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('US'), { target: { value: 'gb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register racer' }));
    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({ emailAddress: 'racer@example.com', countryCode: 'GB' });
    });
  });

  it('shows a validation error for an invalid country code and does not submit', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('racer@example.com'), {
      target: { value: 'racer@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('US'), { target: { value: 'USA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register racer' }));
    await waitFor(() => {
      expect(screen.getByText('Country code must be 2 letters (e.g. US, GB)')).toBeInTheDocument();
    });
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });
});
