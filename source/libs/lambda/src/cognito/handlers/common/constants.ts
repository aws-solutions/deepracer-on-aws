// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export enum UserGroups {
  ADMIN = 'dr-admins',
  RACE_FACILITATORS = 'dr-race-facilitators',
  RACERS = 'dr-racers',
  COMMENTATORS = 'dr-commentators',
  REGISTRATION_MANAGERS = 'dr-registration-managers',
}

/**
 * Must match UserIdentity.EXTERNAL_IDP_NAME (source/apps/infra/lib/constructs/auth/userIdentity.ts)
 * — the SAML identity provider's name on the Cognito user pool. Cognito derives federated users'
 * usernames from this (`${EXTERNAL_IDP_NAME}_<subject>`), which is the only signal available to
 * code that doesn't see the original PreSignUp triggerSource (e.g. getProfile's fallback
 * provisioning, or postAuthentication which runs on every login, not just signup). Kept here, not
 * imported from infra, since the lambda and infra apps are separate deployables with no shared
 * package between them for this value.
 */
export const EXTERNAL_IDP_NAME = 'sso';

// The user pool has signInCaseSensitive: false, so Cognito lowercases every username, including
// the federated ones — compare case-insensitively.
export function isFederatedUserName(userName: string): boolean {
  return userName.toLowerCase().startsWith(`${EXTERNAL_IDP_NAME.toLowerCase()}_`);
}
