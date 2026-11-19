// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Spinner from '@cloudscape-design/components/spinner';
import { getCurrentUser, signInWithRedirect } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

import { AuthState } from '#constants/auth.js';
import { PageId } from '#constants/pages.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { environmentConfig } from '#utils/envUtils.js';
import { getPath } from '#utils/pageUtils.js';

import { needsProfileCompletion } from '../../pages/Auth/utils/postSignInRouting.js';

// Amplify's own OAuth listener (registered as a side effect when `signInWithRedirect` is first
// imported, and triggered off Amplify.configure()) exchanges the Hosted UI redirect's `code` for
// tokens asynchronously in the background — it is NOT awaited by configureAuth(). getCurrentUser()
// can therefore reject because that exchange hasn't finished yet, not because the user truly
// isn't authenticated. Without this check, that transient rejection would navigate to sign-in
// with a bare path, discarding the `code`/`error` query params Amplify still needs.
const hasPendingOAuthRedirect = (search: string) => /[?&](code|error)=/.test(search);

// A brand-new federated identity's very first token exchange can fail (a known Cognito
// eventual-consistency quirk right after PreSignUp_ExternalProvider creates the linked user) even
// though every subsequent login for that same identity succeeds immediately. Rather than making
// the user notice the failure and click "Sign in with SSO" again themselves, retry once
// automatically — the IdP session is already active, so the round trip is effectively invisible.
// This flag must survive the full-page redirect (a fresh page load, not just a re-render), hence
// sessionStorage rather than React state — and it's scoped to one retry so a genuine, persistent
// misconfiguration still surfaces as a real error instead of looping.
const SSO_RETRY_FLAG_KEY = 'sso-redirect-retry-attempted';

// Safety net in case the Hub event is ever missed (e.g. an Amplify internal error outside the
// documented success/failure events) — without this, a missed event would spin forever instead
// of falling back to sign-in.
const OAUTH_COMPLETION_TIMEOUT_MS = 10_000;

const RequiresAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const redirectToSignIn = () => {
      navigate(getPath(PageId.SIGN_IN), {
        state: {
          redirectUrl: location.pathname,
        },
      });
    };

    const checkAuth = () => {
      getCurrentUser()
        .then(() => {
          sessionStorage.removeItem(SSO_RETRY_FLAG_KEY);
          setIsAuthenticated(true);
          setIsAuthChecking(false);
        })
        .catch(() => {
          // Still mid OAuth-redirect-return: wait for Amplify's Hub signal below instead of
          // bouncing away and losing the code/error query params.
          if (!hasPendingOAuthRedirect(location.search)) {
            redirectToSignIn();
          }
        });
    };

    checkAuth();

    if (!hasPendingOAuthRedirect(location.search)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      sessionStorage.removeItem(SSO_RETRY_FLAG_KEY);
      redirectToSignIn();
    }, OAUTH_COMPLETION_TIMEOUT_MS);
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        clearTimeout(timeoutId);
        checkAuth();
      } else if (payload.event === 'signInWithRedirect_failure') {
        clearTimeout(timeoutId);
        if (environmentConfig.idpName && !sessionStorage.getItem(SSO_RETRY_FLAG_KEY)) {
          sessionStorage.setItem(SSO_RETRY_FLAG_KEY, 'true');
          void signInWithRedirect({ provider: { custom: environmentConfig.idpName } });
        } else {
          sessionStorage.removeItem(SSO_RETRY_FLAG_KEY);
          redirectToSignIn();
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate, location.pathname, location.search]);

  // Safety net for "signed in, but profile has no racer alias yet" — covers both a federated
  // (SSO Hosted UI redirect-return) sign-in landing back on a protected route, and any other
  // path that could leave a profile without an alias, since every protected route passes
  // through here. SignInForm's own post-sign-in navigation handles the non-redirect case
  // immediately, so this mostly fires for the redirect-return path.
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useGetProfileQuery(undefined, { skip: !isAuthenticated });
  // A failed fetch (500, stale-session 403, etc.) must not be mistaken for "no alias yet" —
  // needsProfileCompletion(undefined) is true either way, which would otherwise bounce an
  // already-fully-provisioned user into CompleteProfileForm on a transient API failure.
  const needsCompletion = isAuthenticated && !profileError && needsProfileCompletion(profile);

  useEffect(() => {
    if (!isProfileLoading && needsCompletion) {
      navigate(getPath(PageId.SIGN_IN), {
        state: { authState: AuthState.COMPLETE_PROFILE, redirectUrl: location.pathname },
      });
    }
  }, [isProfileLoading, needsCompletion, navigate, location.pathname]);

  if (isAuthChecking || (isAuthenticated && isProfileLoading)) {
    return <Spinner />;
  }

  if (needsCompletion) {
    return <Spinner />;
  }

  return <Outlet />;
};

export default RequiresAuth;
