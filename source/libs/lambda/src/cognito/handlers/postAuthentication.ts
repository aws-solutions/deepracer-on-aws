// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { PostAuthenticationTriggerHandler } from 'aws-lambda';

import { UserGroups } from './common/constants';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * PostAuthentication trigger — ensures every successfully authenticated user is a member of
 * the default racer group.
 *
 * PostConfirmation only fires for users who go through Cognito's native sign-up/confirm flow;
 * federated (SAML/SSO) users never hit that step, so without this trigger they would
 * authenticate successfully but never get assigned to dr-racers (and therefore never pick up
 * the racer IAM role via the Identity Pool role mapping). This trigger fires on every
 * successful authentication — including federated sign-in — and is idempotent: it checks
 * current group membership before adding, so it's a no-op for users already in the group.
 *
 * The membership check looks for ANY dr-* group, not just dr-racers — an admin who has been
 * explicitly moved to dr-admins (and removed from dr-racers) must not be re-added to dr-racers
 * on their next login.
 */
export const PostAuthentication: PostAuthenticationTriggerHandler = async (event) => {
  const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });

  const { userPoolId, userName } = event;

  try {
    const { Groups = [] } = await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: userName,
      }),
    );

    const drGroupPrefix = 'dr-';
    const isInAnyDrGroup = Groups.some((group) => group.GroupName?.startsWith(drGroupPrefix));

    if (!isInAnyDrGroup) {
      await cognitoClient.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: userName,
          GroupName: UserGroups.RACERS,
        }),
      );
    }
  } catch (error) {
    console.log(error);
    throw new Error('Failed to ensure user group membership');
  }

  return event;
};

export const lambdaHandler = instrumentHandler(PostAuthentication);
