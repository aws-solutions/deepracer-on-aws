// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

import { environmentConfig } from './envUtils.js';

export const configureAuth = () => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: environmentConfig.userPoolId,
        userPoolClientId: environmentConfig.userPoolClientId,
        identityPoolId: environmentConfig.identityPoolId,
        allowGuestAccess: true,
        // Hosted UI / signInWithRedirect is only wired up when a SAML IdP was configured on the
        // user pool (see the infra's isSamlIdpEnabled condition). The Hosted UI domain prefix
        // (`${namespace}-dr-auth`) and region are both already exposed on EnvironmentConfig, so
        // the full Cognito domain can be derived here rather than needing a new config field.
        // redirectSignIn/redirectSignOut must match the CallbackURLs/LogoutURLs the infra side
        // registers on the user pool client (updateOAuthCallbackUrls), which are the website's
        // own origin — i.e. exactly window.location.origin at runtime.
        ...(environmentConfig.idpEnabled && environmentConfig.namespace
          ? {
              loginWith: {
                oauth: {
                  domain: `${environmentConfig.namespace}-dr-auth.auth.${environmentConfig.region}.amazoncognito.com`,
                  scopes: ['openid', 'email', 'profile'],
                  redirectSignIn: [window.location.origin],
                  redirectSignOut: [window.location.origin],
                  responseType: 'code' as const,
                },
              },
            }
          : {}),
      },
    },
  });
};

export const getUserEmail = async () => {
  const authSession = await fetchAuthSession();
  return authSession.tokens?.idToken?.payload.email as string;
};

export const checkUserGroupMembership = async (groupsToCheck: UserGroups[]): Promise<boolean> => {
  try {
    const authSession = await fetchAuthSession();
    const userGroups = (authSession.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];

    return groupsToCheck.some((group) => userGroups.includes(group));
  } catch (error) {
    console.error('Error determining user group memebership');
    return false;
  }
};

export const getUserGroups = async (): Promise<UserGroups[]> => {
  try {
    const authSession = await fetchAuthSession();
    const raw = (authSession.tokens?.accessToken?.payload['cognito:groups'] as string[]) ?? [];
    return raw.filter((g): g is UserGroups => Object.values(UserGroups).includes(g as UserGroups));
  } catch {
    return [];
  }
};
