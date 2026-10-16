// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminAddUserToGroupCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

import { UserGroups } from './constants.js';
import { cognitoClient } from '../../../utils/clients/cognitoClient.js';

const DR_GROUP_PREFIX = 'dr-';

/**
 * Adds a user to the default racer group, unless they're already a member of any dr-* group —
 * an admin who has been explicitly moved to a different dr-* group (e.g. dr-admins) must not be
 * reset back to dr-racers.
 *
 * Shared by PostConfirmation (runs once, at native sign-up) and PostAuthentication (runs on
 * every successful federated sign-in, and doubles as a safety net if PostConfirmation is ever
 * retried) so the two triggers can't drift into inconsistent group-assignment behavior.
 */
export async function ensureDefaultRacerGroupMembership(userPoolId: string, userName: string): Promise<void> {
  const { Groups = [] } = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    }),
  );

  const isInAnyDrGroup = Groups.some((group) => group.GroupName?.startsWith(DR_GROUP_PREFIX));
  if (!isInAnyDrGroup) {
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: userName,
        GroupName: UserGroups.RACERS,
      }),
    );
  }
}
