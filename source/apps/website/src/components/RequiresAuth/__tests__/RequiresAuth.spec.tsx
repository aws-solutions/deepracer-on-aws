// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from '@testing-library/react';
import { getCurrentUser, signInWithRedirect } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import { environmentConfig } from '#utils/envUtils.js';

import RequiresAuth from '../RequiresAuth';

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
  signInWithRedirect: vi.fn(),
}));

let hubListener: ((capsule: { payload: { event: string } }) => void) | undefined;
const mockHubUnsubscribe = vi.fn();
vi.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: (_channel: string, listener: typeof hubListener) => {
      hubListener = listener;
      return mockHubUnsubscribe;
    },
  },
}));

const mockNavigate = vi.fn();
let mockLocationSearch = '';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/home', search: mockLocationSearch }),
    Outlet: () => <div data-testid="outlet">protected content</div>,
  };
});

let mockProfileQueryResult: { data?: { alias?: string }; isLoading: boolean; error?: unknown };
vi.mock('#services/deepRacer/profileApi.js', () => ({
  useGetProfileQuery: () => mockProfileQueryResult,
}));

describe('RequiresAuth', () => {
  const originalIdpName = environmentConfig.idpName;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockLocationSearch = '';
    hubListener = undefined;
    environmentConfig.idpName = 'ExternalIdP';
    (getCurrentUser as Mock).mockResolvedValue({ userId: 'user-1' });
  });

  afterEach(() => {
    environmentConfig.idpName = originalIdpName;
  });

  it('renders the outlet once authenticated with a complete profile', async () => {
    mockProfileQueryResult = { data: { alias: 'racer' }, isLoading: false };

    render(<RequiresAuth />);

    expect(await screen.findByTestId('outlet')).toBeInTheDocument();
  });

  it('does not treat a failed profile fetch as an incomplete profile', async () => {
    mockProfileQueryResult = { data: undefined, isLoading: false, error: { status: 500 } };

    render(<RequiresAuth />);

    expect(await screen.findByTestId('outlet')).toBeInTheDocument();
    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
  });

  it('redirects to profile completion when the profile genuinely has no alias', async () => {
    mockProfileQueryResult = { data: { alias: '' }, isLoading: false };

    render(<RequiresAuth />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
  });

  describe('OAuth Hosted UI redirect-return race', () => {
    // Regression tests: getCurrentUser() can reject before Amplify's own (unawaited) background
    // OAuth code exchange finishes, which used to redirect to sign-in and discard the code/error
    // query params the exchange still needed.
    beforeEach(() => {
      mockLocationSearch = '?code=abc123&state=xyz';
      mockProfileQueryResult = { data: { alias: 'racer' }, isLoading: false };
    });

    it('does not redirect to sign-in immediately when getCurrentUser rejects mid OAuth redirect-return', async () => {
      (getCurrentUser as Mock).mockRejectedValue(new Error('not signed in yet'));

      render(<RequiresAuth />);

      await waitFor(() => expect(hubListener).toBeDefined());
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('re-checks auth and renders the outlet once Amplify signals signInWithRedirect', async () => {
      (getCurrentUser as Mock).mockRejectedValueOnce(new Error('not signed in yet'));
      (getCurrentUser as Mock).mockResolvedValueOnce({ userId: 'user-1' });

      render(<RequiresAuth />);
      await waitFor(() => expect(hubListener).toBeDefined());

      hubListener!({ payload: { event: 'signInWithRedirect' } });

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
    });

    it('automatically retries the SSO redirect once on the first signInWithRedirect_failure', async () => {
      (getCurrentUser as Mock).mockRejectedValue(new Error('not signed in yet'));

      render(<RequiresAuth />);
      await waitFor(() => expect(hubListener).toBeDefined());

      hubListener!({ payload: { event: 'signInWithRedirect_failure' } });

      await waitFor(() => expect(signInWithRedirect).toHaveBeenCalledWith({ provider: { custom: 'ExternalIdP' } }));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('gives up and redirects to sign-in on a second signInWithRedirect_failure (retry already used)', async () => {
      sessionStorage.setItem('sso-redirect-retry-attempted', 'true');
      (getCurrentUser as Mock).mockRejectedValue(new Error('not signed in yet'));

      render(<RequiresAuth />);
      await waitFor(() => expect(hubListener).toBeDefined());

      hubListener!({ payload: { event: 'signInWithRedirect_failure' } });

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(signInWithRedirect).not.toHaveBeenCalled();
    });

    it('redirects to sign-in on failure without retrying when SSO is not configured', async () => {
      environmentConfig.idpName = '';
      (getCurrentUser as Mock).mockRejectedValue(new Error('not signed in yet'));

      render(<RequiresAuth />);
      await waitFor(() => expect(hubListener).toBeDefined());

      hubListener!({ payload: { event: 'signInWithRedirect_failure' } });

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(signInWithRedirect).not.toHaveBeenCalled();
    });

    it('clears the retry flag once authenticated, so a later unrelated attempt is not suppressed', async () => {
      sessionStorage.setItem('sso-redirect-retry-attempted', 'true');

      render(<RequiresAuth />);

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      expect(sessionStorage.getItem('sso-redirect-retry-attempted')).toBeNull();
    });

    it('falls back to sign-in if no Hub event arrives within the completion timeout', async () => {
      vi.useFakeTimers();
      (getCurrentUser as Mock).mockRejectedValue(new Error('not signed in yet'));

      render(<RequiresAuth />);
      await vi.waitFor(() => expect(hubListener).toBeDefined());

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockNavigate).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
