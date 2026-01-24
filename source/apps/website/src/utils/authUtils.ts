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
