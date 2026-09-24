// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { generateResourceId } from '@deepracer-indy/database';

import { UserGroups } from '../../cognito/handlers/common/constants.js';
import { cognitoClient } from '../../utils/clients/cognitoClient.js';

/**
 * Low-level Cognito user-onboarding operations shared by the single-user `createProfile` flow
 * and the bulk-invite Step Functions iteration, so the two do not duplicate the racer-onboarding
 * sequence ("reuses the existing single-user createProfile logic"). These wrappers
 * are intentionally thin: they issue one Cognito API call each and let raw errors propagate, so
 * each caller can apply its own error mapping / rollback / per-entry result semantics.
 */

/** True if a user with the given email already exists in the pool. */
export async function userExistsByEmail(userPoolId: string, emailAddress: string): Promise<boolean> {
  const response = await cognitoClient.send(
    new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${emailAddress}"` }),
  );
  return (response.Users?.length ?? 0) > 0;
}

/**
 * Alias constraints enforced by the PreSignUp trigger (`isValidAlias` in preSignUp.ts):
 * 3-20 characters, letters/digits/hyphens/underscores only. Kept in sync manually since the
 * two files run in different Lambdas and don't share a module.
 */
const ALIAS_MIN_LENGTH = 3;
const ALIAS_MAX_LENGTH = 20;
const DISALLOWED_ALIAS_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;

/**
 * Derive a Cognito-alias-safe candidate from a free-text CSV `displayName`. Bulk invite has
 * no alias input of its own, unlike self-registration's dedicated racer-alias field. Spaces and
 * any other character outside `[a-zA-Z0-9_-]` are stripped rather
 * than rejecting the whole entry, so "Alice Smith" becomes "AliceSmith". Returns `undefined` if
 * the input is absent or the sanitized result is too short to satisfy the alias's 3-character
 * minimum — callers should fall back to the PreSignUp trigger's default alias in that case.
 */
export function sanitizeDisplayNameToAlias(displayName?: string): string | undefined {
  if (!displayName) return undefined;
  const sanitized = displayName.replace(DISALLOWED_ALIAS_CHARS_REGEX, '').slice(0, ALIAS_MAX_LENGTH);
  return sanitized.length >= ALIAS_MIN_LENGTH ? sanitized : undefined;
}

/**
 * Create a racer Cognito user with a generated username and send the invitation email
 * (AdminCreateUser with EMAIL delivery). Returns the generated username.
 *
 * `racerAlias`, when provided, is set as the `custom:racerAlias` attribute so the PreSignUp
 * trigger can pick it up as the profile's alias. This is the bulk-invite path's only way to
 * propagate a display-name-derived alias: AdminCreateUser has no ClientMetadata parameter (the
 * mechanism the self-service SignUp flow uses to pass its racerAlias), so a custom attribute on
 * `UserAttributes` — which IS forwarded to PreSignUp as `request.userAttributes` — is used
 * instead.
 */
export async function createRacerCognitoUser(
  userPoolId: string,
  emailAddress: string,
  racerAlias?: string,
): Promise<string> {
  const username = generateResourceId();
  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      DesiredDeliveryMediums: ['EMAIL'],
      UserAttributes: [
        { Name: 'email', Value: emailAddress },
        { Name: 'email_verified', Value: 'true' },
        ...(racerAlias === undefined ? [] : [{ Name: 'custom:racerAlias', Value: racerAlias }]),
      ],
    }),
  );
  return username;
}

/** Add a user to the Racers group. */
export async function addUserToRacerGroup(userPoolId: string, username: string): Promise<void> {
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: UserGroups.RACERS }),
  );
}

/** Delete a Cognito user (used to roll back a partial onboarding). */
export async function deleteCognitoUser(userPoolId: string, username: string): Promise<void> {
  await cognitoClient.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
}

/** Find the Cognito username for an email address, or null if no user matches. */
export async function findCognitoUsernameByEmail(userPoolId: string, emailAddress: string): Promise<string | null> {
  const response = await cognitoClient.send(
    new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${emailAddress}"`, Limit: 1 }),
  );
  return response.Users?.[0]?.Username ?? null;
}

/** Read a Cognito user's status and enabled flag (AdminGetUser). */
export async function getCognitoUserState(
  userPoolId: string,
  username: string,
): Promise<{ status?: string; enabled?: boolean }> {
  const response = await cognitoClient.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }));
  return { status: response.UserStatus, enabled: response.Enabled };
}

/**
 * Resend the Cognito invitation email for an existing user, generating a new temporary password
 * (AdminCreateUser with `MessageAction: RESEND`). Only valid for users in FORCE_CHANGE_PASSWORD.
 */
export async function resendRacerInvite(userPoolId: string, username: string): Promise<void> {
  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      MessageAction: 'RESEND',
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );
}
