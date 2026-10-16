// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Spinner from '@cloudscape-design/components/spinner';
import { getCurrentUser } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

import { AuthState } from '#constants/auth.js';
import { PageId } from '#constants/pages.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { getPath } from '#utils/pageUtils.js';

import { needsProfileCompletion } from '../../pages/Auth/utils/postSignInRouting.js';

const RequiresAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(() => {
        setIsAuthenticated(true);
        setIsAuthChecking(false);
      })
      .catch(() => {
        navigate(getPath(PageId.SIGN_IN), {
          state: {
            redirectUrl: location.pathname,
          },
        });
      });
  }, [navigate, location.pathname]);

  // Safety net for "signed in, but profile has no racer alias yet" — covers both a federated
  // (SSO Hosted UI redirect-return) sign-in landing back on a protected route, and any other
  // path that could leave a profile without an alias, since every protected route passes
  // through here. SignInForm's own post-sign-in navigation handles the non-redirect case
  // immediately, so this mostly fires for the redirect-return path.
  const { data: profile, isLoading: isProfileLoading } = useGetProfileQuery(undefined, { skip: !isAuthenticated });

  useEffect(() => {
    if (isAuthenticated && !isProfileLoading && needsProfileCompletion(profile)) {
      navigate(getPath(PageId.SIGN_IN), {
        state: { authState: AuthState.COMPLETE_PROFILE, redirectUrl: location.pathname },
      });
    }
  }, [isAuthenticated, isProfileLoading, profile, navigate, location.pathname]);

  if (isAuthChecking || (isAuthenticated && isProfileLoading)) {
    return <Spinner />;
  }

  if (isAuthenticated && needsProfileCompletion(profile)) {
    return <Spinner />;
  }

  return <Outlet />;
};

export default RequiresAuth;
