// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile } from '@deepracer-indy/typescript-client';
import { NavigateFunction } from 'react-router-dom';

import { AuthState } from '#constants/auth.js';
import { PageId } from '#constants/pages.js';
import { getPath } from '#utils/pageUtils.js';

/**
 * A profile is considered incomplete when it has no racer alias yet — the signal
 * `getProfile`'s JIT-provisioning fallback uses for brand-new (e.g. first SSO login) profiles.
 */
export const needsProfileCompletion = (profile?: Profile | null): boolean => !profile?.alias;

/**
 * Shared "where do we go after the user is fully authenticated" logic, used both by the native
 * sign-in flow (SignInForm, after confirmSignIn-based challenges complete) and the federated
 * SSO-redirect-return flow (RequiresAuth), so the two call sites can't drift apart.
 */
export const navigatePostSignIn = (
  navigate: NavigateFunction,
  profile: Profile | undefined | null,
  redirectUrl?: string,
) => {
  if (needsProfileCompletion(profile)) {
    navigate(getPath(PageId.SIGN_IN), { state: { authState: AuthState.COMPLETE_PROFILE, redirectUrl } });
    return;
  }
  navigate(redirectUrl ?? getPath(PageId.HOME));
};

interface NextSignInStep {
  signInStep: string;
}

export interface MfaRedirectState {
  authState: AuthState;
}

/**
 * Both `signIn()` and `confirmSignIn()` can return further challenges before a user is actually
 * fully authenticated — e.g. a brand-new admin account chains straight into
 * NEW_PASSWORD_REQUIRED. Any screen that calls `confirmSignIn` (SignInForm, NewPasswordForm) MUST
 * check this before treating the sign-in as complete — calling an authenticated API (e.g.
 * updateProfile) or navigating home while a challenge is still pending fails silently and leaves
 * the user looking "logged out" even though Cognito is just waiting on the next step. Returns the
 * redirect state for the next challenge, or `null` when there is none (caller should proceed with
 * its own post-sign-in logic, e.g. navigatePostSignIn).
 */
export const resolveNextSignInStep = (nextStep: NextSignInStep, accountName: string): MfaRedirectState | null => {
  if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
    return { authState: AuthState.NEW_PASSWORD_REQUIRED };
  }

  return null;
};
